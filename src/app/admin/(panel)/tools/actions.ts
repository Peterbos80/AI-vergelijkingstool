'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { audit, requireAdmin } from '@/lib/auth/session';
import { addPlan, approveTexts, publishTool, saveBasics, saveText, setCapabilities, unpublishTool, validateBasics, type Basics } from '@/lib/admin/tools';
import type { BillingPeriod } from '@/lib/db/schema';

const UUID = /^[0-9a-f-]{36}$/i;
const STATUSES = ['active', 'beta', 'waitlist', 'deprecated', 'shutdown', 'unknown'] as const;
const PERIODS: BillingPeriod[] = ['month', 'year', 'one_time', 'usage', 'custom'];

function toolId(formData: FormData): string {
  const id = String(formData.get('toolId') ?? '');
  if (!UUID.test(id)) redirect('/admin/tools');
  return id;
}
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max);
const opt = (f: FormData, k: string) => str(f, k) || null;
const lines = (f: FormData, k: string) => str(f, k, 2000).split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6);
const back = (id: string, flash: string) => `/admin/tools/${id}?flash=${flash}`;

export async function saveBasicsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = toolId(formData);
  const status = str(formData, 'status') as Basics['status'];
  const b: Basics = {
    name: str(formData, 'name', 80),
    status: STATUSES.includes(status) ? status : 'unknown',
    websiteUrl: str(formData, 'websiteUrl'),
    pricingUrl: opt(formData, 'pricingUrl'),
    changelogUrl: opt(formData, 'changelogUrl'),
    rssUrl: opt(formData, 'rssUrl'),
    githubRepo: opt(formData, 'githubRepo'),
    youtubeChannelId: opt(formData, 'youtubeChannelId'),
  };
  if (validateBasics(b)) redirect(back(id, 'invalid'));
  await saveBasics(getDb(), id, b, `owner:${user.email}`);
  await audit(user, 'tool_basics_saved', 'tool', id);
  redirect(back(id, 'saved'));
}

export async function saveTextAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = toolId(formData);
  const locale = str(formData, 'locale', 5);
  if (!['nl', 'en', 'de', 'fr'].includes(locale)) redirect(back(id, 'invalid'));
  const tagline = str(formData, 'tagline', 120);
  const description = str(formData, 'description', 1200);
  if (!tagline || !description) redirect(back(id, 'invalid'));
  await saveText(getDb(), id, locale, { tagline, description, bestFor: lines(formData, 'bestFor'), notFor: lines(formData, 'notFor'), limitations: lines(formData, 'limitations') }, `owner:${user.email}`);
  await audit(user, 'tool_text_saved', 'tool', id, { locale });
  redirect(back(id, 'saved'));
}

export async function approveTextsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = toolId(formData);
  await approveTexts(getDb(), id, `owner:${user.email}`);
  await audit(user, 'tool_texts_approved', 'tool', id);
  redirect(back(id, 'saved'));
}

export async function capabilitiesAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = toolId(formData);
  const list = (k: string) => str(formData, k, 1000).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const unknown = await setCapabilities(getDb(), id, list('primary'), list('secondary'), `owner:${user.email}`);
  await audit(user, 'tool_capabilities_saved', 'tool', id);
  redirect(back(id, unknown.length ? 'invalid' : 'saved'));
}

export async function addPlanAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = toolId(formData);
  const planKey = str(formData, 'planKey', 40).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const name = str(formData, 'name', 60);
  const currency = str(formData, 'currency', 3).toUpperCase();
  const period = str(formData, 'billingPeriod') as BillingPeriod;
  const isFree = formData.get('isFree') === 'on';
  const cents = (k: string) => {
    const v = str(formData, k).replace(',', '.');
    return v === '' ? null : Math.round(Number(v) * 100);
  };
  const price = cents('price');
  const annual = cents('annualMonthly');
  if (!planKey || !name || !/^[A-Z]{3}$/.test(currency) || !PERIODS.includes(period) || (!isFree && (price === null || !Number.isFinite(price) || price < 0 || price > 10_000_000))) {
    redirect(back(id, 'invalid'));
  }
  await addPlan(getDb(), id, { planKey, name, priceCents: price, annualMonthlyCents: annual !== null && Number.isFinite(annual) ? annual : null, currency, billingPeriod: period, isFree }, `owner:${user.email}`);
  await audit(user, 'tool_plan_added', 'tool', id, { planKey });
  redirect(back(id, 'saved'));
}

export async function publishAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const id = toolId(formData);
  const reasons = await publishTool(getDb(), id, `owner:${user.email}`);
  await audit(user, reasons.length ? 'tool_publish_blocked' : 'tool_published', 'tool', id, { reasons });
  redirect(back(id, reasons.length ? 'publishBlocked' : 'saved'));
}

export async function unpublishAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const id = toolId(formData);
  await unpublishTool(getDb(), id, `owner:${user.email}`);
  await audit(user, 'tool_unpublished', 'tool', id);
  redirect(back(id, 'saved'));
}
