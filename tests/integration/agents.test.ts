/**
 * Agent behaviour against a real (in-process) PostgreSQL with the seed data,
 * using fixture pages instead of the network. Time is simulated per run.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../setup/pglite';
import type { Database } from '@/lib/db/client';
import { loadSeedData } from '@/lib/seed/load';
import { applySeed } from '@/lib/seed/apply';
import {
  affiliateLinks,
  affiliatePrograms,
  agentActions,
  agentConfigs,
  changeEvents,
  emailOutbox,
  healthChecks,
  leads,
  matchQueries,
  newsItems,
  outboundClicks,
  pendingChanges,
  pricingPlans,
  reviewItems,
  settings as settingsTable,
  sources,
  subscribers,
  toolCandidates,
  tools,
  watches,
} from '@/lib/db/schema';
import { fixtureFetcher } from '@/agents/fetcher/http';
import { runAgent } from '@/agents/runner';
import { AGENTS } from '@/agents/registry';
import { validSchedule } from '@/agents/schedule';
import { revertAction } from '@/agents/actions';
import { DEPENDENCIES } from '@/lib/ops/dependencies';
import { DEFAULT_SETTINGS, saveSetting } from '@/lib/settings';
import { buildWeeklyReport, reportPeriod } from '@/lib/reports/weekly';
import { trend } from '@/lib/reports/metrics';
import type { AgentName } from '@/agents/types';
import { NEWS_SOURCES } from '@/lib/news';

const T0 = new Date('2026-09-30T08:00:00Z');
const hours = (h: number) => new Date(T0.getTime() + h * 3600_000);
let db: Database;
let close: () => Promise<void>;

async function run(name: AgentName, pages: Parameters<typeof fixtureFetcher>[0], at: Date) {
  return runAgent(name, { db, fetcher: fixtureFetcher(pages), now: () => at, trigger: 'test', force: true });
}

async function toolBySlug(slug: string) {
  const [t] = await db.select().from(tools).where(eq(tools.slug, slug));
  return t!;
}

async function currentPlans(toolId: string) {
  return db.select().from(pricingPlans).where(and(eq(pricingPlans.toolId, toolId), isNull(pricingPlans.validTo)));
}

/** Make only these tools' pricing pages due for the next run. */
async function onlyDue(slugs: string[], at: Date) {
  await db.execute(sql`UPDATE sources SET last_fetched_at = ${at.toISOString()}::timestamptz WHERE role = 'pricing'`);
  for (const slug of slugs) {
    const t = await toolBySlug(slug);
    await db.update(sources).set({ lastFetchedAt: null }).where(and(eq(sources.toolId, t.id), eq(sources.role, 'pricing')));
  }
}

function pricingPage(plans: [string, string][]) {
  return { body: `<html><body>${plans.map(([n, p]) => `<div><h3>${n}</h3><p>${p}</p></div>`).join('')}</body></html>` };
}

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
  process.env.EMAIL_MODE = 'log';
  await applySeed(db, loadSeedData(), T0);
});
afterAll(async () => {
  delete process.env.EMAIL_MODE;
  await close();
});

describe('registry and dependency register', () => {
  it('registers every agent once with a valid schedule', () => {
    const names = AGENTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(21);
    for (const a of AGENTS) expect(validSchedule(a.schedule), a.name).toBe(true);
  });
  it('dependencies-registered: every required integration and optional key is in the register', () => {
    const keys = new Set(DEPENDENCIES.map((d) => d.key));
    for (const a of AGENTS) for (const r of a.requires ?? []) expect(keys.has(r), `${a.name} requires ${r}`).toBe(true);
    const actions = DEPENDENCIES.map((d) => d.ownerAction).join(' ');
    for (const env of ['DATABASE_URL', 'HEARTBEAT_URL', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY', 'YOUTUBE_API_KEY', 'GITHUB_TOKEN', 'PRODUCTHUNT_TOKEN', 'LEGAL_NAME']) {
      expect(actions, env).toContain(env);
    }
  });
});

describe('pricing agent: anchoring, confirmation by repetition, hard rules, revert', () => {
  const ORIGINAL: [string, string][] = [
    ['Free', '$0 / month'],
    ['Starter', '$6/month'],
    ['Creator', '$22/month'],
  ];

  it('marks plans VERIFIED when the known price is next to the plan name', async () => {
    await onlyDue(['elevenlabs'], hours(0));
    const r = await run('pricing', { 'https://elevenlabs.io/pricing': pricingPage(ORIGINAL) }, hours(0));
    expect(r.status).toBe('success');
    const plans = await currentPlans((await toolBySlug('elevenlabs')).id);
    expect(plans.filter((p) => p.status === 'verified').map((p) => p.planKey).sort()).toEqual(['creator', 'free', 'starter']);
    const verified = await db.select().from(agentActions).where(eq(agentActions.action, 'plan_verified'));
    expect(verified.length).toBe(3);
  });

  it('observes a changed price once, publishes it only after a second identical measurement ≥ 6 h later', async () => {
    const changed: [string, string][] = [ORIGINAL[0]!, ['Starter', '$7/month'], ORIGINAL[2]!];
    const tool = await toolBySlug('elevenlabs');
    await onlyDue(['elevenlabs'], hours(1));
    await run('pricing', { 'https://elevenlabs.io/pricing': pricingPage(changed) }, hours(1));
    let starter = (await currentPlans(tool.id)).find((p) => p.planKey === 'starter')!;
    expect(starter.priceCents).toBe(600);
    const [pending] = await db.select().from(pendingChanges).where(and(eq(pendingChanges.toolId, tool.id), eq(pendingChanges.status, 'pending')));
    expect(pending?.observations).toBe(1);

    // Too soon: still waiting.
    await onlyDue(['elevenlabs'], hours(3));
    await run('pricing', { 'https://elevenlabs.io/pricing': pricingPage(changed) }, hours(3));
    starter = (await currentPlans(tool.id)).find((p) => p.planKey === 'starter')!;
    expect(starter.priceCents).toBe(600);

    await onlyDue(['elevenlabs'], hours(8));
    const r = await run('pricing', { 'https://elevenlabs.io/pricing': pricingPage(changed) }, hours(8));
    expect(r.summary).toContain('1 changes published');
    starter = (await currentPlans(tool.id)).find((p) => p.planKey === 'starter')!;
    expect(starter.priceCents).toBe(700);
    const [event] = await db.select().from(changeEvents).where(and(eq(changeEvents.toolId, tool.id), eq(changeEvents.kind, 'price_increase')));
    expect(event?.title.en).toContain('price up from US$6 to US$7');
    expect(event?.title.nl).toContain('prijs omhoog');
  });

  it('reverts a published price change: previous row restored, event withdrawn', async () => {
    const tool = await toolBySlug('elevenlabs');
    const [action] = await db.select().from(agentActions).where(and(eq(agentActions.action, 'price_published'), eq(agentActions.toolId, tool.id)));
    expect(await revertAction(db, action!.id, 'test')).toBe('reverted');
    const starter = (await currentPlans(tool.id)).find((p) => p.planKey === 'starter')!;
    expect(starter.priceCents).toBe(600);
    const [event] = await db.select().from(changeEvents).where(and(eq(changeEvents.toolId, tool.id), eq(changeEvents.kind, 'price_increase')));
    expect(event?.status).toBe('rejected');
    expect(await revertAction(db, action!.id, 'test')).toBe('already');
  });

  it('escalates a > 50% jump with a safe default, and the escalation agent applies it after the deadline', async () => {
    const tool = await toolBySlug('elevenlabs');
    const jump: [string, string][] = [ORIGINAL[0]!, ORIGINAL[1]!, ['Creator', '$45/month']];
    for (const h of [10, 17]) {
      await onlyDue(['elevenlabs'], hours(h));
      await run('pricing', { 'https://elevenlabs.io/pricing': pricingPage(jump) }, hours(h));
    }
    const [item] = await db.select().from(reviewItems).where(and(eq(reviewItems.kind, 'price_change'), eq(reviewItems.toolId, tool.id), eq(reviewItems.status, 'pending')));
    expect(item?.severity).toBe('p2');
    expect(item?.reasonCode).toBe('price_increase_over_limit');
    expect(item?.defaultAction).toBe('publish_with_label');
    expect((await currentPlans(tool.id)).find((p) => p.planKey === 'creator')!.priceCents).toBe(2200);

    // Before the deadline nothing happens; after 72 h the labelled default is applied.
    await run('escalation', {}, hours(20));
    expect((await currentPlans(tool.id)).find((p) => p.planKey === 'creator')!.priceCents).toBe(2200);
    await run('escalation', {}, hours(17 + 73));
    expect((await currentPlans(tool.id)).find((p) => p.planKey === 'creator')!.priceCents).toBe(4500);
    const [after] = await db.select().from(reviewItems).where(eq(reviewItems.id, item!.id));
    expect(after?.status).toBe('defaulted');
  });

  it('freezes a run with too many confirmed changes (anomaly guard)', async () => {
    await saveSetting(db, 'anomaly', { ...DEFAULT_SETTINGS.anomaly, maxPriceChanges: 1 }, 'test');
    const pages = {
      'https://elevenlabs.io/pricing': pricingPage([ORIGINAL[0]!, ['Starter', '$8/month'], ['Creator', '$45/month']]),
      'https://www.descript.com/pricing': pricingPage([['Free', '$0/month'], ['Hobbyist', '$25/month'], ['Creator', '$35/month'], ['Business', '$65/month']]),
    };
    for (const h of [100, 107]) {
      await onlyDue(['elevenlabs', 'descript'], hours(h));
      await run('pricing', pages, hours(h));
    }
    const [freeze] = await db.select().from(reviewItems).where(eq(reviewItems.kind, 'anomaly_freeze'));
    expect(freeze?.reasonCode).toBe('too_many_price_changes');
    expect((await currentPlans((await toolBySlug('descript')).id)).find((p) => p.planKey === 'hobbyist')!.priceCents).toBe(2400);
    await saveSetting(db, 'anomaly', DEFAULT_SETTINGS.anomaly, 'test');
  });
});

describe('broken-link agent', () => {
  it('suspects our own network when most checks fail, and changes nothing', async () => {
    const all = await db.select().from(sources).where(eq(sources.role, 'website'));
    await db.update(sources).set({ lastFetchedAt: null }).where(eq(sources.role, 'website'));
    const pages = Object.fromEntries(all.map((s) => [s.url, new Error('ECONNREFUSED')]));
    const r = await run('broken-link', pages, hours(200));
    expect(r.status).toBe('partial');
    const down = await db.select().from(tools).where(eq(tools.websiteStatus, 'down'));
    expect(down).toHaveLength(0);
    const [item] = await db.select().from(reviewItems).where(eq(reviewItems.reasonCode, 'network_suspected'));
    expect(item?.severity).toBe('p2');
  });

  it('marks a site unreachable only after ≥ 3 failures over ≥ 24 h, and restores it automatically', async () => {
    const tool = await toolBySlug('descript');
    const site = (await db.select().from(sources).where(and(eq(sources.toolId, tool.id), eq(sources.role, 'website'))))[0]!;
    await db.update(sources).set({ failureCount: 0, failingSince: null }).where(eq(sources.id, site.id));
    const failing = { [site.url]: new Error('ECONNRESET') };
    for (const h of [300, 312, 325]) {
      await db.execute(sql`UPDATE sources SET last_fetched_at = ${hours(h).toISOString()}::timestamptz WHERE role = 'website'`);
      await db.update(sources).set({ lastFetchedAt: null }).where(eq(sources.id, site.id));
      await run('broken-link', failing, hours(h));
      const t = await toolBySlug('descript');
      expect(t.websiteStatus, `after ${h - 300} h`).toBe(h === 325 ? 'down' : t.websiteStatus);
    }
    expect((await toolBySlug('descript')).websiteStatus).toBe('down');
    await db.update(sources).set({ lastFetchedAt: null }).where(eq(sources.id, site.id));
    await run('broken-link', { [site.url]: { body: '<html>ok</html>' } }, hours(330));
    expect((await toolBySlug('descript')).websiteStatus).toBe('up');
    const kinds = (await db.select().from(changeEvents).where(eq(changeEvents.toolId, tool.id))).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['website_down', 'website_up']));
  });
});

describe('escalation agent', () => {
  it('applies defaults, expires stale P3, auto-resolves cleared items, pauses failing agents and enforces the budget', async () => {
    await db.delete(reviewItems);
    const base = { category: 'data' as const, payload: {}, createdBy: 'test', title: 't' };
    const now = hours(400);
    const [due] = await db.insert(reviewItems).values({ ...base, kind: 'price_change', severity: 'p2', defaultAction: 'keep_old_price_flag', dueAt: hours(399), createdAt: hours(300) }).returning();
    const [stale] = await db.insert(reviewItems).values({ ...base, kind: 'duplicate', severity: 'p3', createdAt: hours(400 - 31 * 24) }).returning();
    const [dep] = await db.insert(reviewItems).values({ ...base, kind: 'dependency', severity: 'p2', payload: { check: 'fx' }, defaultAction: 'auto_resolve_when_checks_pass', createdAt: hours(390) }).returning();
    await db.insert(healthChecks).values({ key: 'fx', status: 'ok', message: 'ok', lastCheckedAt: hours(395), lastOkAt: hours(395) }).onConflictDoUpdate({ target: healthChecks.key, set: { status: 'ok', lastCheckedAt: hours(395) } });
    for (let i = 0; i < 7; i++) await db.insert(reviewItems).values({ ...base, kind: 'opportunity', severity: 'p2', priority: 60, createdAt: hours(399), title: `opp ${i}` });
    await db.update(agentConfigs).set({ consecutiveFailures: 3, enabled: true }).where(eq(agentConfigs.agent, 'social'));

    await run('escalation', {}, now);
    const byId = async (id: string) => (await db.select().from(reviewItems).where(eq(reviewItems.id, id)))[0]!;
    expect((await byId(due!.id)).status).toBe('defaulted');
    expect((await byId(stale!.id)).status).toBe('expired');
    expect((await byId(dep!.id)).status).toBe('auto_resolved');
    const [social] = await db.select().from(agentConfigs).where(eq(agentConfigs.agent, 'social'));
    expect(social?.enabled).toBe(false);
    const failing = await db.select().from(reviewItems).where(eq(reviewItems.kind, 'agent_failing'));
    expect(failing).toHaveLength(1);
    const openP2 = await db.select().from(reviewItems).where(and(eq(reviewItems.status, 'pending'), eq(reviewItems.severity, 'p2')));
    expect(openP2.length).toBeLessThanOrEqual(DEFAULT_SETTINGS.autonomy.escalationBudgetPerWeek + 1); // +1: the agent_failing item (priority 60) may stay
    const demoted = await db.select().from(reviewItems).where(sql`${reviewItems.payload} ? 'demotedByBudget'`);
    expect(demoted.length).toBeGreaterThanOrEqual(2);
    await db.update(agentConfigs).set({ consecutiveFailures: 0, enabled: true }).where(eq(agentConfigs.agent, 'social'));
  });
});

describe('runner', () => {
  it('prevents overlapping runs with a lease and counts failures', async () => {
    const [a, b] = await Promise.all([run('quality', {}, hours(500)), run('quality', {}, hours(500))]);
    expect([a.status, b.status].sort()).toEqual(['locked', 'success']);
    const r = await run('fx', {}, hours(501)); // ECB page missing → failed run
    expect(r.status).toBe('failed');
    const [cfg] = await db.select().from(agentConfigs).where(eq(agentConfigs.agent, 'fx'));
    expect(cfg?.consecutiveFailures).toBe(1);
  });
});

describe('reports and metrics', () => {
  it('applies the noise rule', () => {
    expect(trend(100, 60)).toBe('up');
    expect(trend(65, 60)).toBe('normal');
    expect(trend(20, 60)).toBe('down');
    expect(trend(10, 5)).toBe('insufficient');
    expect(trend(10, null)).toBe('insufficient');
  });

  it('computes the reporting week in the owner time zone', () => {
    const cfg = DEFAULT_SETTINGS.report;
    const wed = reportPeriod(new Date('2026-09-30T10:00:00Z'), cfg);
    expect(wed.period.start.toISOString()).toBe('2026-09-20T22:00:00.000Z'); // Mon 21 Sep 00:00 CEST
    expect(wed.period.end.toISOString()).toBe('2026-09-27T22:00:00.000Z');
    const earlyMonday = reportPeriod(new Date('2026-09-28T03:00:00Z'), cfg); // 05:00 local, before 07:00
    expect(earlyMonday.period.end.toISOString()).toBe('2026-09-20T22:00:00.000Z');
    const winter = reportPeriod(new Date('2026-11-04T10:00:00Z'), cfg);
    expect(winter.period.start.toISOString()).toBe('2026-10-25T23:00:00.000Z'); // Mon 26 Oct 00:00 CET
  });

  it('never shows unknown revenue as zero', async () => {
    const period = { start: hours(-24 * 7), end: T0 };
    let report = await buildWeeklyReport(db, period, DEFAULT_SETTINGS, T0);
    const aff = () => report.revenue.streams.find((s) => s.stream === 'affiliate')!;
    expect(aff().status).toBe('not_configured');
    expect(report.revenue.totalEurCents).toBeNull();
    expect(report.unmeasured).toContain('affiliate_none');

    const tool = await toolBySlug('canva');
    await db.insert(affiliatePrograms).values({ toolId: tool.id, network: 'test', status: 'approved' });
    report = await buildWeeklyReport(db, period, DEFAULT_SETTINGS, T0);
    expect(aff().status).toBe('unknown');
    expect(aff().eurCents).toBeNull();
    expect(report.revenue.lowerBound).toBe(true);
    expect(report.unmeasured).toContain('revenue_import');
    expect(report.seo?.total).toBeGreaterThan(0);
  });
});

describe('notifier', () => {
  it('sends a Watch digest only when there is news, to confirmed subscribers only', async () => {
    const tool = await toolBySlug('canva');
    const [confirmed] = await db
      .insert(subscribers)
      .values({ email: 'watcher@example.test', locale: 'nl', status: 'confirmed', unsubscribeToken: 'tok_confirmed_1234567890', consentText: 'x', source: 'tool_watch', confirmedAt: hours(-200) })
      .returning();
    const [pending] = await db
      .insert(subscribers)
      .values({ email: 'pending@example.test', locale: 'en', status: 'pending', unsubscribeToken: 'tok_pending_12345678901', consentText: 'x', source: 'tool_watch' })
      .returning();
    await db.insert(watches).values([
      { subscriberId: confirmed!.id, toolId: tool.id, createdAt: hours(-24 * 8) },
      { subscriberId: pending!.id, toolId: tool.id, createdAt: hours(-24 * 8) },
    ]);
    await db.insert(changeEvents).values({ toolId: tool.id, kind: 'price_decrease', title: { nl: 'Canva: prijs omlaag', en: 'Canva: price down' }, detectedAt: hours(-24), detectedBy: 'test', confidence: 95, sourceUrl: 'https://www.canva.com/pricing/' });
    await run('notifier', {}, T0);
    const mails = await db.select().from(emailOutbox).where(eq(emailOutbox.kind, 'digest'));
    expect(mails.map((m) => m.toEmail)).toEqual(['watcher@example.test']);
    expect(mails[0]!.bodyText).toContain('Canva: prijs omlaag');
    expect(mails[0]!.bodyText).toContain('/nl/newsletter/unsubscribe?token=tok_confirmed_1234567890');
    expect(mails[0]!.status).toBe('logged');
    // Next run: window closed, nothing new.
    await run('notifier', {}, hours(1));
    expect(await db.select().from(emailOutbox).where(eq(emailOutbox.kind, 'digest'))).toHaveLength(1);
  });

  it('skips a newsletter issue with too little news and sends one with enough', async () => {
    await db.update(subscribers).set({ newsletter: true }).where(eq(subscribers.email, 'watcher@example.test'));
    const wed = (d: string) => new Date(`${d}T12:00:00Z`);
    await run('notifier', {}, wed('2026-11-11')); // week of 2 Nov: no events
    const [state] = await db.select().from(settingsTable).where(eq(settingsTable.key, 'newsletter_last_issue'));
    expect(state?.value).toMatchObject({ issue: '2026-11-02', status: 'skipped' });
    const tool = await toolBySlug('elevenlabs');
    for (let i = 0; i < 3; i++) {
      await db.insert(changeEvents).values({ toolId: tool.id, kind: 'plan_added', title: { en: `Plan ${i}`, nl: `Plan ${i}` }, detectedAt: new Date(`2026-11-1${i + 0}T10:00:00Z`), detectedBy: 'test', confidence: 95 });
    }
    const before = (await db.select().from(emailOutbox)).length;
    await run('notifier', {}, wed('2026-11-18')); // week of 9 Nov: 3 events
    const after = await db.select().from(emailOutbox);
    expect(after.length).toBe(before + 1);
    expect(after.find((m) => m.subject.startsWith('Wat is nieuw'))?.toEmail).toBe('watcher@example.test');
    // Idempotent within the week.
    await run('notifier', {}, wed('2026-11-18'));
    expect((await db.select().from(emailOutbox)).length).toBe(before + 1);
  });
});

describe('opportunity and monetization agents', () => {
  it('values affiliate coverage from measured clicks, labelled as an estimate', async () => {
    const tool = await toolBySlug('descript');
    await db.insert(outboundClicks).values(Array.from({ length: 200 }, (_, i) => ({ id: `click-${i}`, toolId: tool.id, linkKind: 'direct' as const, ts: hours(-24) })));
    await run('opportunity', {}, T0);
    const [item] = await db.select().from(reviewItems).where(and(eq(reviewItems.kind, 'opportunity'), eq(reviewItems.toolId, tool.id)));
    expect(item?.reasonCode).toBe('affiliate_coverage');
    expect(item?.impact?.evCentsPerMonth).toBe(6600); // 200 × 1.5% × €22 (assumption)
    expect(item?.impact?.evBasis).toContain('assumption');
  });

  it('deactivates an affiliate link that lands on another domain, reversibly', async () => {
    const tool = await toolBySlug('elevenlabs');
    const [program] = await db.insert(affiliatePrograms).values({ toolId: tool.id, network: 'test', status: 'approved' }).returning();
    const [link] = await db.insert(affiliateLinks).values({ toolId: tool.id, programId: program!.id, urlTemplate: 'https://partner.example.net/track?sub={click_id}', active: true }).returning();
    await run('monetization', { 'https://partner.example.net/track?sub=linkcheck': { body: '<html>partner</html>' } }, T0);
    const [after] = await db.select().from(affiliateLinks).where(eq(affiliateLinks.id, link!.id));
    expect(after?.active).toBe(false);
    const [action] = await db.select().from(agentActions).where(eq(agentActions.action, 'affiliate_link_deactivated'));
    // The URL it judged, so a push of the same URL in data/affiliates.json does not switch it back on.
    expect(action?.oldValue).toEqual({ active: true, urlTemplate: 'https://partner.example.net/track?sub={click_id}' });
    expect(await revertAction(db, action!.id, 'test')).toBe('reverted');
    expect((await db.select().from(affiliateLinks).where(eq(affiliateLinks.id, link!.id)))[0]?.active).toBe(true);
  });
});

describe('verification agent', () => {
  it('verifies a plausible AI tool with a dossier and rejects a blocklisted one; never publishes', async () => {
    await db.insert(toolCandidates).values([
      { name: 'VoxNova', url: 'https://voxnova.example/', domain: 'voxnova.example', source: 'hackernews', signals: { hnPoints: 60 } },
      { name: 'LuckySpin', url: 'https://luckyspin.example/', domain: 'luckyspin.example', source: 'hackernews', signals: { hnPoints: 25 } },
    ]);
    const home = `<html><head><title>VoxNova — AI voice generator</title><meta name="description" content="Turn text into natural speech with AI voices."></head>
      <body><a href="/pricing">Pricing</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><p>Text to speech for creators.</p></body></html>`;
    const pages = {
      'https://voxnova.example/': { body: home },
      'https://voxnova.example/pricing': { body: '<html><body><h3>Free</h3><p>$0</p><h3>Pro</h3><p>$10/month</p></body></html>' },
      'https://luckyspin.example/': { body: '<html><head><title>LuckySpin AI casino bonus</title></head><body>AI powered casino</body></html>' },
    };
    const publishedBefore = (await db.select().from(tools).where(eq(tools.published, true))).length;
    await run('verification', pages, T0);
    const cands = await db.select().from(toolCandidates);
    expect(cands.find((c) => c.domain === 'voxnova.example')?.status).toBe('verified');
    expect(cands.find((c) => c.domain === 'luckyspin.example')?.status).toBe('rejected');
    const [item] = await db.select().from(reviewItems).where(eq(reviewItems.kind, 'new_tool'));
    expect(item?.defaultAction).toBe('reject_after_30d');
    const dossier = (item?.payload as { dossier: { pricing: { amounts: string[] }; legal: { privacy: boolean } } }).dossier;
    expect(dossier.legal.privacy).toBe(true);
    expect(dossier.pricing.amounts.join(' ')).toContain('$10');
    expect((await db.select().from(tools).where(eq(tools.published, true))).length).toBe(publishedBefore);
  });
});

describe('video and social agents', () => {
  it('select their due tools and finish without a database error', async () => {
    // Regression: "ORDER BY col NULLS FIRST ASC" is invalid SQL and failed both agents in production.
    for (const name of ['video', 'social'] as const) {
      const r = await run(name, {}, hours(30));
      expect(r.status, `${name}: ${r.summary}`).not.toBe('failed');
    }
  });
});

describe('news agent', () => {
  const feed = (id: string) => NEWS_SOURCES.find((s) => s.id === id)!.url;
  const rss = (items: { title: string; link: string; date: string }[]) =>
    `<?xml version="1.0"?><rss version="2.0"><channel><title>News</title>${items
      .map((i) => `<item><title>${i.title}</title><link>${i.link}</link><guid>${i.link}</guid><pubDate>${i.date}</pubDate></item>`)
      .join('')}</channel></rss>`;
  // The shape of a YouTube channel feed.
  const atom = (entries: { id: string; title: string; date: string }[]) =>
    `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">${entries
      .map(
        (e) =>
          `<entry><id>yt:video:${e.id}</id><yt:videoId>${e.id}</yt:videoId><yt:channelId>UCGq-a57w-aPwyi3pW7XLiHw</yt:channelId><title>${e.title}</title><link rel="alternate" href="https://www.youtube.com/watch?v=${e.id}"/><author><name>The Diary Of A CEO</name></author><published>${e.date}</published></entry>`,
      )
      .join('')}</feed>`;
  const emptyRss = { contentType: 'application/rss+xml', body: rss([]) };

  it('publishes AI items with headline, outlet and link, tags watched experts, skips off-topic items and never duplicates', async () => {
    const at = hours(40);
    const day = new Date(at.getTime() - 3600_000).toUTCString();
    const pages = {
      [feed('bbc-tech')]: {
        contentType: 'application/rss+xml',
        body: rss([
          { title: 'Geoffrey Hinton warns AI could &quot;outsmart&quot; us', link: 'https://www.bbc.com/news/articles/a1?utm_source=rss&amp;at_medium=feed', date: day },
          { title: 'New folding phone goes on sale', link: 'https://www.bbc.com/news/articles/b2', date: day },
        ]),
      },
      [feed('yt-doac')]: { contentType: 'application/atom+xml', body: atom([{ id: 'abcdefghijk', title: 'Roman Yampolskiy: can we control superintelligence?', date: new Date(at.getTime() - 7200_000).toISOString() }]) },
      [feed('verge-ai')]: { contentType: 'application/rss+xml', body: rss([{ title: 'A new open model &lt;em&gt;beats&lt;/em&gt; the benchmarks', link: 'https://www.theverge.com/ai/1', date: day }]) },
    };
    const first = await run('news', pages, at);
    expect(first.status).toBe('partial'); // the other feeds answer 404 in this fixture
    const rows = await db.select().from(newsItems).orderBy(newsItems.url);
    expect(rows.map((r) => [r.sourceId, r.kind, r.title, r.url, r.people])).toEqual([
      ['bbc-tech', 'article', 'Geoffrey Hinton warns AI could "outsmart" us', 'https://www.bbc.com/news/articles/a1', ['geoffrey-hinton']],
      ['verge-ai', 'article', 'A new open model beats the benchmarks', 'https://www.theverge.com/ai/1', []],
      ['yt-doac', 'video', 'Roman Yampolskiy: can we control superintelligence?', 'https://www.youtube.com/watch?v=abcdefghijk', ['roman-yampolskiy']],
    ]);
    // Same feeds an hour later: nothing new, nothing duplicated.
    const again = await run('news', pages, hours(41));
    expect(again.stats.items_new ?? 0).toBe(0);
    expect(await db.select().from(newsItems)).toHaveLength(3);
    // Every source that could not be read is named, with the reason.
    expect(again.summary).toMatch(/^3\/12 feeds · 0 new items · 0 pruned · failed: guardian-ai \(http 404\), /);
  });

  it('skips sources whose robots.txt disallows them, names them, and does not count that as a failure', async () => {
    const articles = Object.fromEntries(NEWS_SOURCES.filter((s) => s.kind === 'article').map((s) => [s.url, emptyRss]));
    const fixtures = fixtureFetcher(articles);
    const requested: string[] = [];
    const fetcher = {
      async get(url: string, opts?: { api?: boolean }) {
        requested.push(url);
        if (url.startsWith('https://www.youtube.com/')) return { ok: false, url, finalUrl: url, status: null, contentType: null, body: '', durationMs: 1, redirects: [], errorKind: 'robots' as const, error: 'disallowed by robots.txt' };
        return fixtures.get(url, opts);
      },
    };
    const r = await runAgent('news', { db, fetcher, now: () => hours(42), trigger: 'test', force: true });
    expect(r.status).toBe('success');
    expect(r.summary).toContain('skipped, robots.txt disallows: yt-cnbc, yt-bloomberg-tech, yt-60-minutes, yt-doac, yt-lex-fridman (YouTube channels: set YOUTUBE_API_KEY)');
    expect(r.stats.feed_robots).toBe(5);
    expect(requested.some((u) => u.includes('googleapis.com'))).toBe(false);
  });

  it('reads YouTube channels through the YouTube Data API when a key is set, refreshes them and removes them 30 days after the last refresh', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    try {
      const at = hours(43);
      const playlist = (channel: string) =>
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=25&playlistId=UU${channel.slice(2)}&key=test-key`;
      const item = (id: string, title: string, published?: string) => ({
        snippet: { title, channelTitle: 'The Diary Of A CEO', channelId: 'UCGq-a57w-aPwyi3pW7XLiHw', resourceId: { kind: 'youtube#video', videoId: id } },
        contentDetails: published ? { videoId: id, videoPublishedAt: published } : { videoId: id },
      });
      const pages: Parameters<typeof fixtureFetcher>[0] = {
        [playlist('UCGq-a57w-aPwyi3pW7XLiHw')]: {
          contentType: 'application/json; charset=UTF-8',
          body: JSON.stringify({
            items: [
              item('abcdefghijk', 'Roman Yampolskiy: can we control superintelligence? (updated title)', new Date(at.getTime() - 7200_000).toISOString()),
              item('zzzzzzzzzz1', 'Geoffrey Hinton on the risks of AI', new Date(at.getTime() - 3600_000).toISOString()),
              item('zzzzzzzzzz2', 'Private video'),
            ],
          }),
        },
      };
      const requested: string[] = [];
      const fixtures = fixtureFetcher(pages);
      const fetcher = {
        async get(url: string, opts?: { api?: boolean }) {
          requested.push(url);
          return fixtures.get(url, opts);
        },
      };
      const r = await runAgent('news', { db, fetcher, now: () => at, trigger: 'test', force: true });
      // The channel feeds on youtube.com are not requested at all; the API is.
      expect(requested.filter((u) => u.startsWith('https://www.youtube.com/'))).toEqual([]);
      expect(r.summary).toContain('1/12 feeds (1 via YouTube API)');
      expect(r.summary).not.toContain('test-key');
      const videos = await db.select().from(newsItems).where(eq(newsItems.kind, 'video')).orderBy(newsItems.url);
      expect(videos.map((v) => [v.url, v.title, v.people, v.fetchedAt.getTime()])).toEqual([
        ['https://www.youtube.com/watch?v=abcdefghijk', 'Roman Yampolskiy: can we control superintelligence? (updated title)', ['roman-yampolskiy'], at.getTime()],
        ['https://www.youtube.com/watch?v=zzzzzzzzzz1', 'Geoffrey Hinton on the risks of AI', ['geoffrey-hinton'], at.getTime()],
      ]);
      expect(r.stats.items_new).toBe(1);
      // No longer listed: gone 30 days after the last refresh; articles stay for 90 days.
      const later = await runAgent('news', { db, fetcher: fixtureFetcher({}), now: () => new Date(at.getTime() + 31 * 86_400_000), trigger: 'test', force: true });
      expect(later.stats.items_pruned).toBe(2);
      expect(await db.select().from(newsItems).where(eq(newsItems.kind, 'video'))).toEqual([]);
      expect((await db.select().from(newsItems).where(eq(newsItems.kind, 'article'))).length).toBeGreaterThan(0);
    } finally {
      delete process.env.YOUTUBE_API_KEY;
    }
  });
});

describe('recommendation agent (golden-set regression guard)', () => {
  it('passes on the seed and escalates a regression after a data change', async () => {
    const ok = await run('recommendation', {}, T0);
    expect(ok.summary).toMatch(/^27\/27 golden cases pass/);
    await db.execute(sql`DELETE FROM tasks WHERE id = 'long-videos-to-shorts'`);
    await db.execute(sql`INSERT INTO settings (key, value, updated_by) VALUES ('data_version', '999'::jsonb, 'test') ON CONFLICT (key) DO UPDATE SET value = '999'::jsonb`);
    const bad = await run('recommendation', {}, hours(24));
    expect(bad.summary).toContain('regression');
    const [item] = await db.select().from(reviewItems).where(eq(reviewItems.kind, 'regression'));
    expect(JSON.stringify(item?.payload)).toContain('shorts');
  });
});

describe('P1 alerts', () => {
  it('e-mails the owner once per new P1 item, never for P2 or duplicates, capped per day', async () => {
    const { escalate } = await import('@/lib/ops/inbox');
    const { MAX_ALERTS_PER_DAY } = await import('@/lib/ops/alerts');
    process.env.OWNER_EMAIL = 'owner@example.test';
    try {
      // Real clock: the daily cap counts outbox rows, which the database timestamps.
      const base = { kind: 'security' as const, severity: 'p1' as const, category: 'security' as const, title: 'test alert', reasonCode: 'login_failures', payload: {}, createdBy: 'test', now: new Date() };
      const alerts = () => db.select().from(emailOutbox).where(eq(emailOutbox.kind, 'alert'));
      const first = await escalate(db, { ...base, dedupeKey: 'alert-test-1', defaultAction: 'keep_open' });
      expect((await escalate(db, { ...base, dedupeKey: 'alert-test-1' })).created).toBe(false);
      await escalate(db, { ...base, severity: 'p2', dedupeKey: 'alert-test-p2' });
      const sent = await alerts();
      expect(sent).toHaveLength(1);
      expect(sent[0]!.toEmail).toBe('owner@example.test');
      expect(sent[0]!.subject).toMatch(/^(Dringend|Urgent): /);
      expect(sent[0]!.bodyText).toContain(`/admin/inbox/${first.id}`);
      for (let i = 2; i <= MAX_ALERTS_PER_DAY + 3; i++) await escalate(db, { ...base, dedupeKey: `alert-test-${i}` });
      expect(await alerts()).toHaveLength(MAX_ALERTS_PER_DAY);
    } finally {
      delete process.env.OWNER_EMAIL;
    }
  });
});

// Last in the file: it runs the quality agent far in the future, which ages every snapshot.
describe('retention (privacy page)', () => {
  it('deletes exactly what the retention rules cover, on the agent clock', async () => {
    const at = hours(24 * 900);
    const ago = (days: number) => new Date(at.getTime() - days * 86_400_000);
    const [oldLead, contactedLead, newLead] = await db
      .insert(leads)
      .values([
        { kind: 'stack_advice' as const, name: 'A', email: 'a@example.test', locale: 'nl', createdAt: ago(800) },
        { kind: 'stack_advice' as const, name: 'B', email: 'b@example.test', locale: 'nl', createdAt: ago(800), lastContactAt: ago(30) },
        { kind: 'stack_advice' as const, name: 'C', email: 'c@example.test', locale: 'nl', createdAt: ago(30) },
      ])
      .returning({ id: leads.id });
    const sub = (email: string, status: 'pending' | 'confirmed', days: number) => ({
      email,
      locale: 'nl',
      status,
      unsubscribeToken: `retention-${email}`,
      consentText: 'test',
      source: 'newsletter' as const,
      createdAt: ago(days),
    });
    await db.insert(subscribers).values([sub('stale-pending@example.test', 'pending', 31), sub('fresh-pending@example.test', 'pending', 5), sub('old-confirmed@example.test', 'confirmed', 400)]);
    const mail = (subject: string, status: 'sent' | 'queued', days: number) => ({ toEmail: 'x@example.test', subject, bodyText: '-', kind: 'other' as const, status, createdAt: ago(days) });
    await db.insert(emailOutbox).values([mail('retention-old-sent', 'sent', 91), mail('retention-old-queued', 'queued', 91), mail('retention-new-sent', 'sent', 10)]);
    const mq = (queryHash: string, days: number) => ({ locale: 'nl', queryHash, engine: 'lexical' as const, confidence: 50, ts: ago(days) });
    await db.insert(matchQueries).values([mq('retention-old', 91), mq('retention-new', 10)]);

    const r = await run('quality', {}, at);
    expect(r.status).toBe('success');

    const leadIds = (await db.select({ id: leads.id }).from(leads)).map((x) => x.id);
    expect(leadIds).not.toContain(oldLead!.id);
    expect(leadIds).toEqual(expect.arrayContaining([contactedLead!.id, newLead!.id]));
    const emails = (await db.select({ e: subscribers.email }).from(subscribers)).map((x) => x.e);
    expect(emails).not.toContain('stale-pending@example.test');
    expect(emails).toEqual(expect.arrayContaining(['fresh-pending@example.test', 'old-confirmed@example.test']));
    const subjects = (await db.select({ s: emailOutbox.subject }).from(emailOutbox)).map((x) => x.s);
    expect(subjects).not.toContain('retention-old-sent');
    expect(subjects).toEqual(expect.arrayContaining(['retention-old-queued', 'retention-new-sent']));
    const hashes = (await db.select({ h: matchQueries.queryHash }).from(matchQueries)).map((x) => x.h);
    expect(hashes).not.toContain('retention-old');
    expect(hashes).toContain('retention-new');
  });
});
