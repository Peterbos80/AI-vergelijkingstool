/**
 * Reporter agent (docs/strategy/12 §7): builds the weekly owner report once
 * the reporting week is complete and due (default Monday 07:00). Runs hourly
 * and is idempotent, so a worker that was down on Monday catches up later.
 */
import { and, eq } from 'drizzle-orm';
import { reports } from '@/lib/db/schema';
import { emailEnabled, env, siteUrl } from '@/lib/env';
import { flushOutbox, queueEmail } from '@/lib/email/outbox';
import { buildWeeklyReport, renderReportEmail, reportPeriod, summarize } from '@/lib/reports/weekly';
import { localDate } from '../schedule';
import type { AgentContext, AgentDefinition } from '../types';

async function emailReport(ctx: AgentContext, report: typeof reports.$inferSelect): Promise<boolean> {
  const to = env().OWNER_EMAIL;
  if (!to || !emailEnabled()) return false;
  const locale = ctx.settings.owner.locale;
  const mail = renderReportEmail(report.data as never, locale, siteUrl(`/admin/reports/${report.id}`));
  await queueEmail({ to, subject: mail.subject, text: mail.text, kind: 'digest' }, ctx.db);
  await flushOutbox(5, ctx.db);
  await ctx.db.update(reports).set({ emailedAt: ctx.now() }).where(eq(reports.id, report.id));
  return true;
}

export const reporterAgent: AgentDefinition = {
  name: 'reporter',
  description: 'Builds the weekly owner report when the week is complete and e-mails it to OWNER_EMAIL when e-mail is configured.',
  schedule: 'every:1h',
  autonomy: 'auto',
  maxItems: 1,
  timeoutMs: 3 * 60_000,
  async run(ctx) {
    const { db, settings } = ctx;
    const now = ctx.now();
    const { period, dueAt } = reportPeriod(now, settings.report);
    if (now < dueAt) return { status: 'skipped', summary: 'no report due' };
    const periodStart = localDate(period.start, settings.report.timezone);
    const [existing] = await db.select().from(reports).where(and(eq(reports.kind, 'weekly'), eq(reports.periodStart, periodStart)));
    if (existing) {
      // Retry delivery once e-mail becomes available; never rebuild a stored report.
      if (!existing.emailedAt && (await emailReport(ctx, existing))) return { status: 'success', summary: `report ${periodStart} e-mailed` };
      return { status: 'skipped', summary: `report ${periodStart} exists` };
    }
    const data = await buildWeeklyReport(db, period, settings, now);
    const [row] = await db
      .insert(reports)
      .values({
        kind: 'weekly',
        periodStart,
        periodEnd: localDate(new Date(period.end.getTime() - 1), settings.report.timezone),
        data: data as unknown as Record<string, unknown>,
        summary: { nl: summarize(data, 'nl'), en: summarize(data, 'en') },
        createdBy: 'agent:reporter',
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return { status: 'skipped', summary: `report ${periodStart} created concurrently` };
    await ctx.log.action({ action: 'report_created', entityType: 'report', entityId: row.id, decision: 'info', reason: `week of ${periodStart}` });
    const mailed = await emailReport(ctx, row);
    ctx.stat('reports');
    if (mailed) ctx.stat('emailed');
    return { status: 'success', summary: `weekly report ${periodStart}${mailed ? ' (e-mailed)' : ''}` };
  },
};
