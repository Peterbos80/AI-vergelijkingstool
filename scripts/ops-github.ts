/**
 * The owner inbox and weekly report as GitHub issues (static edition, which
 * has no admin area). Runs inside the "Site and agents" workflow:
 *
 *   npx tsx scripts/ops-github.ts sync      P1/P2 inbox items and new weekly
 *                                           reports → issues; close issues whose
 *                                           item is resolved
 *   npx tsx scripts/ops-github.ts command   apply an owner's issue comment:
 *                                           /approve [note], /reject [note],
 *                                           /snooze, /default
 *
 * Needs GITHUB_TOKEN (issues: write) and GITHUB_REPOSITORY; `command` reads
 * the issue_comment event from GITHUB_EVENT_PATH. Only the repository owner's
 * comments are applied. This repository is public: issues contain inbox
 * texts and aggregate figures, never personal data.
 */
import './_env';
import { readFileSync } from 'node:fs';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db/client';
import { reports, reviewItems } from '../src/lib/db/schema';
import { loadSettings } from '../src/lib/settings';
import { getT } from '../src/i18n/server';
import { formatDate } from '../src/i18n/formatters';
import { defaultActionText, ifNothing, kindLabel, reasonText } from '../src/lib/admin/labels';
import { applyDecision } from '../src/lib/admin/decisions';
import { renderReportEmail, type WeeklyReportData } from '../src/lib/reports/weekly';
import { runAgent } from '../src/agents/runner';

const REPO = process.env.GITHUB_REPOSITORY ?? '';
const TOKEN = process.env.GITHUB_TOKEN ?? '';

async function gh<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 422 && method === 'POST' && path === '/labels') return undefined as T; // label exists
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const LABELS: [string, string, string][] = [
  ['ops', '5319e7', 'Owner inbox (automated)'],
  ['p1', 'b60205', 'Act today'],
  ['p2', 'fbca04', 'This week'],
  ['report', '0e8a16', 'Weekly owner report'],
];

async function ensureLabels() {
  for (const [name, color, description] of LABELS) await gh('POST', '/labels', { name, color, description });
}

type Item = typeof reviewItems.$inferSelect;

function issueBody(item: Item, locale: 'nl' | 'en'): string {
  const t = getT(locale);
  const impact = item.impact
    ? [
        item.impact.pages !== undefined ? t('admin.github.impactPages', { n: item.impact.pages }) : null,
        item.impact.visits30d !== undefined ? t('admin.github.impactVisits', { n: item.impact.visits30d }) : null,
        item.impact.evCentsPerMonth !== undefined ? t('admin.github.impactEv', { amount: (item.impact.evCentsPerMonth / 100).toFixed(2) }) : null,
      ].filter(Boolean)
    : [];
  const details = JSON.stringify(item.payload, null, 2).slice(0, 4000);
  return [
    `**${kindLabel(t, item.kind)}** · ${item.severity.toUpperCase()} · ${t(`admin.category.${item.category}`)}`,
    '',
    reasonText(t, item.reasonCode, item.title),
    impact.length ? `\n${impact.join(' · ')}` : '',
    '',
    `**${ifNothing(t, locale, item.defaultAction, item.dueAt)}**`,
    '',
    `<details><summary>${t('admin.github.details')}</summary>\n\n\`\`\`json\n${details}\n\`\`\`\n</details>`,
    '',
    t('admin.github.commands'),
    '',
    `_${t('admin.github.footer', { id: item.id, by: item.createdBy })}_`,
  ].join('\n');
}

async function sync() {
  const db = getDb();
  const locale = (await loadSettings(db)).owner.locale;
  const t = getT(locale);
  await ensureLabels();

  // New P1/P2 items → issues.
  const open = await db
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.status, 'pending'), inArray(reviewItems.severity, ['p1', 'p2']), sql`NOT (${reviewItems.payload} ? 'githubIssue')`));
  for (const item of open) {
    const title = `[${item.severity.toUpperCase()}] ${kindLabel(t, item.kind)}: ${reasonText(t, item.reasonCode, item.title)}`.slice(0, 250);
    const issue = await gh<{ number: number }>('POST', '/issues', { title, body: issueBody(item, locale), labels: ['ops', item.severity] });
    await db
      .update(reviewItems)
      .set({ payload: sql`${reviewItems.payload} || ${JSON.stringify({ githubIssue: issue.number })}::jsonb` })
      .where(eq(reviewItems.id, item.id));
    console.log(`[ops-github] issue #${issue.number} for ${item.kind} ${item.id}`);
  }

  // Resolved items → close their issue once.
  const resolved = await db
    .select()
    .from(reviewItems)
    .where(and(ne(reviewItems.status, 'pending'), sql`${reviewItems.payload} ? 'githubIssue'`, sql`NOT (${reviewItems.payload} ? 'githubClosed')`));
  for (const item of resolved) {
    const n = Number(item.payload.githubIssue);
    const how = item.resolution ?? item.status;
    await gh('POST', `/issues/${n}/comments`, { body: t('admin.github.resolved', { status: t.has(`admin.inbox.status.${item.status}`) ? t(`admin.inbox.status.${item.status}`) : item.status, resolution: how }) });
    await gh('PATCH', `/issues/${n}`, { state: 'closed', state_reason: item.status === 'rejected' || item.status === 'expired' ? 'not_planned' : 'completed' });
    await db
      .update(reviewItems)
      .set({ payload: sql`${reviewItems.payload} || '{"githubClosed": true}'::jsonb` })
      .where(eq(reviewItems.id, item.id));
    console.log(`[ops-github] closed #${n}`);
  }

  // New weekly reports → one issue each; older report issues are closed.
  const fresh = await db
    .select()
    .from(reports)
    .where(and(eq(reports.kind, 'weekly'), isNull(reports.emailedAt), sql`NOT (${reports.data} ? 'githubIssue')`));
  for (const r of fresh) {
    const mail = renderReportEmail(r.data as unknown as WeeklyReportData, locale, null, { trafficMeasured: false });
    const previous = await gh<{ number: number }[]>('GET', '/issues?labels=report&state=open&per_page=20');
    const issue = await gh<{ number: number }>('POST', '/issues', {
      title: t('admin.github.reportTitle', { start: formatDate(r.periodStart, locale), end: formatDate(new Date(new Date(r.periodEnd).getTime() - 86_400_000), locale) }),
      body: ['```', mail.text, '```'].join('\n'),
      labels: ['ops', 'report'],
    });
    for (const p of previous) await gh('PATCH', `/issues/${p.number}`, { state: 'closed', state_reason: 'completed' });
    await db
      .update(reports)
      .set({ data: sql`${reports.data} || ${JSON.stringify({ githubIssue: issue.number })}::jsonb` })
      .where(eq(reports.id, r.id));
    console.log(`[ops-github] weekly report → #${issue.number}`);
  }
}

interface CommentEvent {
  comment: { body: string; author_association: string; user: { login: string; type: string } };
  issue: { number: number };
}

async function command() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8')) as CommentEvent;
  const { comment, issue } = event;
  if (comment.author_association !== 'OWNER' || comment.user.type === 'Bot') {
    console.log('[ops-github] ignored: not the repository owner');
    return;
  }
  const m = /^\/(approve|reject|snooze|default)\b[ \t]*(.*)$/im.exec(comment.body.trim());
  if (!m) return;
  const cmd = m[1]!.toLowerCase();
  const note = m[2]?.trim().slice(0, 500) || null;
  const db = getDb();
  const locale = (await loadSettings(db)).owner.locale;
  const t = getT(locale);
  const [item] = await db
    .select()
    .from(reviewItems)
    .where(sql`(${reviewItems.payload} ->> 'githubIssue')::int = ${issue.number}`)
    .limit(1);
  const reply = async (body: string) => gh('POST', `/issues/${issue.number}/comments`, { body });
  if (!item) return void (await reply(t('admin.github.notFound')));
  if (item.status !== 'pending') return void (await reply(t('admin.github.notPending')));

  const now = new Date();
  if (cmd === 'approve' || cmd === 'reject') {
    const user = { id: 'github', email: `github:${comment.user.login}`, name: comment.user.login, role: 'owner' as const };
    const r = await applyDecision(db, item, cmd, user, note);
    await reply(r.ok ? t('admin.github.applied', { command: `/${cmd}` }) : t('admin.github.conflict'));
  } else if (cmd === 'snooze') {
    await db.update(reviewItems).set({ snoozedUntil: new Date(now.getTime() + 7 * 86_400_000), updatedAt: now }).where(eq(reviewItems.id, item.id));
    await reply(t('admin.github.snoozed'));
  } else {
    // "Apply the default now": due immediately, then let the escalation agent apply it.
    await db.update(reviewItems).set({ dueAt: new Date(now.getTime() - 1000), snoozedUntil: null, updatedAt: now }).where(eq(reviewItems.id, item.id));
    await runAgent('escalation', { trigger: 'api', force: true });
    await reply(t('admin.github.defaulted', { action: defaultActionText(t, item.defaultAction) }));
  }
}

async function main() {
  if (!REPO || !TOKEN) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  const mode = process.argv[2];
  if (mode === 'sync') await sync();
  else if (mode === 'command') await command();
  else throw new Error('usage: ops-github.ts sync|command');
}

main()
  .catch((err) => {
    console.error('[ops-github] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
