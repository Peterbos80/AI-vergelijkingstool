'use server';
import { headers } from 'next/headers';
import { isEnabledLocale, type Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getDb } from '@/lib/db/client';
import { reviewItems } from '@/lib/db/schema';
import { getCatalog } from '@/lib/catalog';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, visitorHash } from '@/lib/analytics/visitor';
import { EMAIL_RE } from '@/lib/subscriptions';

export interface CorrectionState {
  ok: boolean;
  message: string;
}

const FIELDS = new Set(['price', 'free', 'feature', 'status', 'privacy', 'other']);

/** Corrections land in the owner inbox (docs/strategy/12 §5); vendor corrections get priority. */
export async function correctionAction(_prev: CorrectionState | null, formData: FormData): Promise<CorrectionState> {
  const locale = String(formData.get('locale') ?? '');
  if (!isEnabledLocale(locale)) return { ok: false, message: '' };
  const t = getT(locale as Locale);
  if (String(formData.get('website') ?? '') !== '') return { ok: true, message: t('corrections.thanks') };
  const catalog = await getCatalog();
  const tool = catalog.toolsBySlug.get(String(formData.get('tool') ?? ''));
  const field = String(formData.get('field') ?? 'other');
  const correct = String(formData.get('correct') ?? '').trim().slice(0, 1500);
  const source = String(formData.get('source') ?? '').trim().slice(0, 500);
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const vendor = formData.get('vendor') === '1';
  let sourceOk = false;
  try {
    const u = new URL(source);
    sourceOk = u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    sourceOk = false;
  }
  if (!tool || !FIELDS.has(field) || correct.length < 3 || !sourceOk || (email && !EMAIL_RE.test(email))) {
    return { ok: false, message: t('corrections.invalid') };
  }
  const h = await headers();
  if (!(await rateLimit(`corr:${visitorHash(clientIp(h), h.get('user-agent') ?? '')}`, 10, 3600))) {
    return { ok: false, message: t('subscribe.rateLimited') };
  }
  await getDb()
    .insert(reviewItems)
    .values({
      kind: 'correction',
      severity: vendor ? 'p2' : 'p3',
      category: 'data',
      toolId: tool.id,
      title: `Correction (${field}) for ${tool.name}`,
      reasonCode: vendor ? 'vendor_correction' : 'user_correction',
      payload: { field, correct, source, email: email || null, vendor, locale },
      priority: vendor ? 70 : 50,
      createdBy: 'public:corrections',
      defaultAction: 'keep_current_value',
      dueAt: new Date(Date.now() + 7 * 86_400_000),
    });
  return { ok: true, message: t('corrections.thanks') };
}
