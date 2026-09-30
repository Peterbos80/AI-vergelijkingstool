'use server';
/**
 * Save a Match result as a shareable receipt. The stack is recomputed on the
 * server from the submitted URL state — client-provided results are never
 * trusted.
 */
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isEnabledLocale } from '@/i18n/config';
import { getCatalog, taskTextOf, nameOf } from '@/lib/catalog';
import { getDb } from '@/lib/db/client';
import { loadSettings } from '@/lib/settings';
import { runMatch, scrubQuery } from '@/lib/engine/match';
import { parseMatchParams } from '@/lib/engine/params';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, visitorHash } from '@/lib/analytics/visitor';
import { MY_STACKS_COOKIE, parseMyStacks, saveStack, serializeMyStacks } from '@/lib/stacks/store';

export async function saveStackAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? '');
  if (!isEnabledLocale(locale)) return;
  let raw: Record<string, string> = {};
  try {
    const parsed = JSON.parse(String(formData.get('params') ?? '{}')) as unknown;
    if (parsed && typeof parsed === 'object') raw = parsed as Record<string, string>;
  } catch {
    return;
  }
  const h = await headers();
  const allowed = await rateLimit(`save:${visitorHash(clientIp(h), h.get('user-agent') ?? '')}`, 30, 3600);
  if (!allowed) return;

  const p = parseMatchParams(raw);
  if (!p.q && !p.taskOverride) return;
  const catalog = await getCatalog();
  const settings = await loadSettings(getDb());
  const out = await runMatch(
    { query: p.q, locale, explicit: p.explicit, approach: p.approach, taskOverride: p.taskOverride, budget: p.budget, skip: true, answered: p.answered, gatingThreshold: settings.llm.gatingThreshold, allowLlm: allowed },
    catalog,
  );
  if (!out.variants) return;
  const result = out.variants[p.variant];
  const title = out.task && out.task.id !== '__adhoc__'
    ? taskTextOf(out.task, locale).title
    : out.intent.capabilityIds.map((c) => nameOf(catalog.capabilitiesById.get(c)!, locale).name).join(', ');
  const prices: Record<string, { planKey: string | null; cents: number | null; currency: string | null; status: string }> = {};
  for (const line of result.lines) {
    const tool = catalog.toolsById.get(line.toolId);
    prices[line.toolId] = { planKey: line.planKey, cents: line.paidCents, currency: line.currency, status: tool?.pricingStatus ?? 'unverified' };
  }
  const saved = await saveStack({
    locale,
    origin: 'match',
    taskId: result.taskId,
    queryText: scrubQuery(p.q),
    constraints: out.constraints,
    snapshot: { result, title, engine: out.intent.engine, prices },
  });
  const jar = await cookies();
  const mine = parseMyStacks(jar.get(MY_STACKS_COOKIE)?.value);
  jar.set(MY_STACKS_COOKIE, serializeMyStacks([{ id: saved.publicId, token: saved.token }, ...mine]), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(`/${locale}/stack/${saved.publicId}?saved=1`);
}
