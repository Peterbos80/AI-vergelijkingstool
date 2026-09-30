/**
 * Notifier agent: delivers the e-mail outbox, Watch digests and the weekly
 * AI Pulse newsletter. Only confirmed (double opt-in) subscribers receive
 * anything; every message has a one-click unsubscribe link; a digest or an
 * issue without real news is not sent.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { isLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { emailOutbox, settings as settingsTable, stackItems, subscribers, tools, watches } from '@/lib/db/schema';
import { activePlacementFrom } from '@/lib/monetization/placements';
import { queryRows } from '@/lib/db/sql';
import { emailEnabled, siteUrl } from '@/lib/env';
import { flushOutbox } from '@/lib/email/outbox';
import { localized } from '@/lib/catalog/events';
import { href } from '@/lib/routes';
import { reportPeriod } from '@/lib/reports/weekly';
import { localDate } from '../schedule';
import type { AgentContext, AgentDefinition } from '../types';

/** Change kinds worth an e-mail (noise like buzz, videos and releases stays on Pulse). */
export const DIGEST_KINDS = [
  'price_increase',
  'price_decrease',
  'plan_added',
  'plan_removed',
  'free_tier_added',
  'free_tier_removed',
  'status_change',
  'shutdown',
  'rename',
  'policy',
  'acquisition',
  'website_down',
  'new_tool',
] as const;

const PRICE_KINDS = new Set(['price_increase', 'price_decrease', 'plan_added', 'plan_removed', 'free_tier_added', 'free_tier_removed']);
const TOOL_KINDS = new Set(['new_tool', 'shutdown']);

/**
 * The newsletter goes out 33 h after the reporting week ends (Tuesday ~09:00
 * with the default Monday week): a day after the owner report, so bad data
 * can still be frozen or reverted before it reaches subscribers.
 */
export const NEWSLETTER_OFFSET_HOURS = 33;
/** Minimum number of items for a newsletter issue. */
export const NEWSLETTER_MIN_ITEMS = 3;
const ISSUE_KEY = 'newsletter_last_issue';

type EventRow = { id: string; tool_id: string | null; kind: string; title: Record<string, string>; source_url: string | null; detected_at: string; name: string | null; slug: string | null };

function unsubscribeUrl(locale: Locale, tokenValue: string) {
  return siteUrl(`/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(tokenValue)}`);
}

function eventLines(events: EventRow[], locale: Locale): string[] {
  const t = getT(locale);
  const out: string[] = [];
  for (const e of events) {
    const title = localized(e.title, locale) ?? '';
    out.push(`• ${e.name ? `${e.name} — ` : ''}${title}`);
    if (e.slug) out.push(`  ${siteUrl(href.tool(locale, e.slug))}`);
    if (e.source_url) out.push(`  ${t('digest.source', { url: e.source_url })}`);
  }
  return out;
}

async function watchDigests(ctx: AgentContext): Promise<number> {
  const { db } = ctx;
  const now = ctx.now();
  const rows = await queryRows<{
    id: string;
    subscriber_id: string;
    stack_id: string | null;
    tool_id: string | null;
    frequency: 'weekly' | 'daily';
    since: string;
    email: string;
    locale: string;
    unsubscribe_token: string;
  }>(
    db,
    sql`SELECT w.id::text AS id, w.subscriber_id::text AS subscriber_id, w.stack_id::text AS stack_id, w.tool_id::text AS tool_id, w.frequency,
               COALESCE(w.last_notified_at, w.created_at)::text AS since, s.email, s.locale, s.unsubscribe_token
        FROM watches w JOIN subscribers s ON s.id = w.subscriber_id
        WHERE s.status = 'confirmed'
          AND COALESCE(w.last_notified_at, w.created_at) < ${now.toISOString()}::timestamptz
                - CASE w.frequency WHEN 'daily' THEN interval '1 day' ELSE interval '7 days' END
        ORDER BY s.id
        LIMIT ${ctx.limits.maxItems}`,
  );
  const bySubscriber = new Map<string, typeof rows>();
  for (const r of rows) bySubscriber.set(r.subscriber_id, [...(bySubscriber.get(r.subscriber_id) ?? []), r]);
  let sent = 0;
  for (const [, list] of bySubscriber) {
    const first = list[0]!;
    const locale: Locale = isLocale(first.locale) ? first.locale : 'en';
    const toolIds = new Set(list.map((w) => w.tool_id).filter((x): x is string => Boolean(x)));
    const stackIds = list.map((w) => w.stack_id).filter((x): x is string => Boolean(x));
    if (stackIds.length) for (const r of await db.select({ toolId: stackItems.toolId }).from(stackItems).where(inArray(stackItems.stackId, stackIds))) toolIds.add(r.toolId);
    const since = list.map((w) => w.since).sort()[0]!;
    const events = toolIds.size
      ? await queryRows<EventRow>(
          db,
          sql`SELECT e.id::text AS id, e.tool_id::text AS tool_id, e.kind, e.title, e.source_url, e.detected_at::text AS detected_at, t.name, t.slug
              FROM change_events e JOIN tools t ON t.id = e.tool_id
              WHERE e.status = 'published' AND e.detected_at > ${since}::timestamptz AND e.detected_at <= ${now.toISOString()}::timestamptz
                AND e.tool_id IN (${sql.join([...toolIds].map((id) => sql`${id}::uuid`), sql`, `)})
                AND e.kind IN (${sql.join(DIGEST_KINDS.map((k) => sql`${k}`), sql`, `)})
              ORDER BY e.detected_at DESC LIMIT 30`,
        )
      : [];
    if (events.length) {
      const t = getT(locale);
      const text = [
        t('digest.watchIntro', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(since)) }),
        '',
        ...eventLines(events, locale),
        '',
        t('digest.more', { url: siteUrl(href.pulse(locale)) }),
        '',
        t('digest.footerWatch', { url: unsubscribeUrl(locale, first.unsubscribe_token) }),
        t('digest.sign'),
      ].join('\n');
      await db.insert(emailOutbox).values({ toEmail: first.email, subject: t('digest.watchSubject', { count: events.length }), bodyText: text, kind: 'digest' });
      sent++;
    }
    // The digest window closes whether or not there was news (no empty e-mails).
    await db.update(watches).set({ lastNotifiedAt: now }).where(inArray(watches.id, list.map((w) => w.id)));
  }
  return sent;
}

async function newsletter(ctx: AgentContext): Promise<{ status: 'sent' | 'skipped' | 'not_due' | 'already'; recipients: number; items: number }> {
  const { db, settings } = ctx;
  const now = ctx.now();
  const { period } = reportPeriod(now, settings.report);
  if (now.getTime() < period.end.getTime() + NEWSLETTER_OFFSET_HOURS * 3600_000) return { status: 'not_due', recipients: 0, items: 0 };
  const issue = localDate(period.start, settings.report.timezone);
  const [last] = await db.select().from(settingsTable).where(eq(settingsTable.key, ISSUE_KEY));
  if (last && typeof last.value === 'object' && last.value && (last.value as { issue?: string }).issue === issue) return { status: 'already', recipients: 0, items: 0 };

  const events = await queryRows<EventRow>(
    db,
    sql`SELECT e.id::text AS id, e.tool_id::text AS tool_id, e.kind, e.title, e.source_url, e.detected_at::text AS detected_at, t.name, t.slug
        FROM change_events e LEFT JOIN tools t ON t.id = e.tool_id
        WHERE e.status = 'published' AND e.detected_at >= ${period.start.toISOString()}::timestamptz AND e.detected_at < ${period.end.toISOString()}::timestamptz
          AND e.kind IN (${sql.join(DIGEST_KINDS.filter((k) => k !== 'website_down').map((k) => sql`${k}`), sql`, `)})
        ORDER BY e.significance DESC, e.detected_at DESC LIMIT 25`,
  );
  // Record the issue first: at most once, even if queueing is interrupted.
  const record = async (value: Record<string, unknown>) =>
    db
      .insert(settingsTable)
      .values({ key: ISSUE_KEY, value: { issue, ...value }, updatedBy: 'agent:notifier' })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: { issue, ...value }, updatedBy: 'agent:notifier', updatedAt: now } });
  if (events.length < NEWSLETTER_MIN_ITEMS) {
    await record({ status: 'skipped', items: events.length });
    await ctx.log.action({ action: 'newsletter_skipped', decision: 'info', reason: `${events.length} items (< ${NEWSLETTER_MIN_ITEMS}) for week of ${issue}` });
    return { status: 'skipped', recipients: 0, items: events.length };
  }
  const recipients = await db
    .select({ email: subscribers.email, locale: subscribers.locale, token: subscribers.unsubscribeToken })
    .from(subscribers)
    .where(and(eq(subscribers.status, 'confirmed'), eq(subscribers.newsletter, true)));
  await record({ status: 'queued', items: events.length, recipients: recipients.length });
  // The Fair Fight of the week: the most-read head-to-head page of the period.
  const [ff] = await queryRows<{ pair: string | null }>(
    db,
    sql`SELECT props->>'pair' AS pair FROM events WHERE type = 'pageview' AND page_type = 'fair_fight'
          AND ts >= ${period.start.toISOString()}::timestamptz AND ts < ${period.end.toISOString()}::timestamptz AND props ? 'pair'
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  // A paid newsletter placement, if one runs now: labelled and after the news, never mixed into it.
  const placement = await activePlacementFrom(db, 'newsletter', now);
  const [sponsorTool] = placement ? await db.select({ slug: tools.slug, name: tools.name }).from(tools).where(eq(tools.id, placement.toolId)) : [];
  const rows = recipients.map((r) => {
    const locale: Locale = isLocale(r.locale) ? r.locale : 'en';
    const t = getT(locale);
    const sections: [string, EventRow[]][] = [
      [t('digest.sectionPrices'), events.filter((e) => PRICE_KINDS.has(e.kind))],
      [t('digest.sectionTools'), events.filter((e) => TOOL_KINDS.has(e.kind))],
      [t('digest.sectionOther'), events.filter((e) => !PRICE_KINDS.has(e.kind) && !TOOL_KINDS.has(e.kind))],
    ];
    const body = [t('digest.newsletterIntro'), ''];
    for (const [title, list] of sections) if (list.length) body.push(`■ ${title}`, ...eventLines(list, locale), '');
    const pair = ff?.pair && /^[a-z0-9-]+-vs-[a-z0-9-]+$/.test(ff.pair) ? ff.pair : null;
    if (pair) body.push(t('digest.fairFight', { url: siteUrl(`/${locale}/compare/${pair}`) }), '');
    const sponsorText = placement && sponsorTool ? localized(placement.message, locale) : null;
    if (sponsorText) body.push(t('digest.sponsored', { message: sponsorText, url: siteUrl(href.go(sponsorTool!.slug, { src: 'newsletter', l: locale })) }), '');
    body.push(t('digest.more', { url: siteUrl(href.pulse(locale)) }), '', t('digest.footerNewsletter', { url: unsubscribeUrl(locale, r.token) }), t('digest.sign'));
    return { toEmail: r.email, subject: t('digest.newsletterSubject', { count: events.length }), bodyText: body.join('\n'), kind: 'digest' as const };
  });
  for (let i = 0; i < rows.length; i += 500) await db.insert(emailOutbox).values(rows.slice(i, i + 500));
  await ctx.log.action({ action: 'newsletter_queued', decision: 'auto_published', reason: `week of ${issue}: ${events.length} items to ${rows.length} subscribers` });
  return { status: 'sent', recipients: rows.length, items: events.length };
}

export const notifierAgent: AgentDefinition = {
  name: 'notifier',
  description: 'Delivers the e-mail outbox, Watch digests and the weekly AI Pulse newsletter (confirmed subscribers only).',
  schedule: 'every:15m',
  autonomy: 'auto',
  maxItems: 200,
  timeoutMs: 5 * 60_000,
  requires: ['email'],
  async run(ctx) {
    const parts: string[] = [];
    if (emailEnabled()) {
      const digests = await watchDigests(ctx);
      ctx.stat('watch_digests', digests);
      if (digests) parts.push(`${digests} watch digests`);
      const nl = await newsletter(ctx);
      if (nl.status === 'sent') {
        ctx.stat('newsletter_recipients', nl.recipients);
        parts.push(`newsletter: ${nl.items} items → ${nl.recipients} subscribers`);
      } else if (nl.status === 'skipped') parts.push(`newsletter skipped (${nl.items} items)`);
    }
    const flushed = await flushOutbox(ctx.limits.maxItems, ctx.db);
    ctx.stat('sent', flushed.sent);
    ctx.stat('failed', flushed.failed);
    ctx.stat('logged', flushed.logged);
    parts.push(`outbox: ${flushed.sent} sent, ${flushed.logged} logged, ${flushed.failed} failed`);
    return { status: flushed.failed && !flushed.sent ? 'partial' : 'success', summary: parts.join(' · ') };
  },
};
