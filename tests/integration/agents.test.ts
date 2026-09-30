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
    expect(names.length).toBe(19);
    for (const a of AGENTS) expect(validSchedule(a.schedule), a.name).toBe(true);
  });
  it('dependencies-registered: every required integration and optional key is in the register', () => {
    const keys = new Set(DEPENDENCIES.map((d) => d.key));
    for (const a of AGENTS) for (const r of a.requires ?? []) expect(keys.has(r), `${a.name} requires ${r}`).toBe(true);
    const actions = DEPENDENCIES.map((d) => d.ownerAction).join(' ');
    for (const env of ['DATABASE_URL', 'HEARTBEAT_URL', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY', 'YOUTUBE_API_KEY', 'GITHUB_TOKEN', 'LEGAL_NAME']) {
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
    expect(after.find((m) => m.subject.startsWith('AI Pulse'))?.toEmail).toBe('watcher@example.test');
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
