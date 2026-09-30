'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { affiliateLinks, affiliatePrograms, leads, placements, revenueEntries, tools } from '@/lib/db/schema';
import { audit, requireAdmin } from '@/lib/auth/session';
import { importConversions, parseConversions } from '@/lib/admin/commerce';
import { validateTemplate } from '@/agents/defs/monetization';
import { bumpDataVersion } from '@/lib/settings';
import { PLACEMENT_SLOTS, type Slot as PlacementSlot } from '@/lib/monetization/placements';

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max);
const PROGRAM_STATUS = ['researching', 'applied', 'approved', 'rejected', 'paused', 'closed'] as const;
const COMMISSION = ['recurring_percent', 'first_payment_percent', 'flat', 'cpc', 'unknown'] as const;
const KINDS = ['sponsorship', 'newsletter', 'lead', 'data', 'other'] as const;
const LEAD_STATUS = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;

async function toolIdBySlug(slug: string): Promise<string | null> {
  const [t] = await getDb().select({ id: tools.id }).from(tools).where(eq(tools.slug, slug));
  return t?.id ?? null;
}

export async function addProgramAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const toolId = await toolIdBySlug(str(formData, 'tool', 80));
  const status = str(formData, 'status') as (typeof PROGRAM_STATUS)[number];
  const commissionType = str(formData, 'commissionType') as (typeof COMMISSION)[number];
  const value = str(formData, 'commissionValue');
  const cookie = str(formData, 'cookieDays');
  const url = str(formData, 'programUrl');
  if (!toolId || !PROGRAM_STATUS.includes(status) || !COMMISSION.includes(commissionType) || (url && !/^https:\/\//.test(url))) redirect('/admin/commerce?flash=invalid#programs');
  const [row] = await getDb()
    .insert(affiliatePrograms)
    .values({
      toolId,
      network: str(formData, 'network', 60) || 'direct',
      status,
      commissionType,
      commissionValue: value ? Number(value.replace(',', '.')) : null,
      cookieDays: cookie ? Math.max(0, Math.min(3650, Math.round(Number(cookie)))) : null,
      programUrl: url || null,
      infoSourceUrl: url || null,
      notes: str(formData, 'notes', 500) || null,
    })
    .returning({ id: affiliatePrograms.id });
  await audit(user, 'program_added', 'affiliate_program', row?.id);
  redirect('/admin/commerce?flash=saved#programs');
}

export async function programStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const id = str(formData, 'programId');
  const status = str(formData, 'status') as (typeof PROGRAM_STATUS)[number];
  if (!UUID.test(id) || !PROGRAM_STATUS.includes(status)) redirect('/admin/commerce?flash=invalid#programs');
  await getDb().update(affiliatePrograms).set({ status }).where(eq(affiliatePrograms.id, id));
  await audit(user, 'program_status', 'affiliate_program', id, { status });
  redirect('/admin/commerce?flash=saved#programs');
}

export async function addLinkAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const toolId = await toolIdBySlug(str(formData, 'tool', 80));
  const template = str(formData, 'urlTemplate', 1000);
  const programId = str(formData, 'programId');
  if (!toolId || validateTemplate(template)) redirect('/admin/commerce?flash=invalid#links');
  const db = getDb();
  const [row] = await db
    .insert(affiliateLinks)
    .values({ toolId, programId: UUID.test(programId) ? programId : null, urlTemplate: template, active: formData.get('active') === 'on', createdBy: `owner:${user.email}` })
    .returning({ id: affiliateLinks.id });
  await bumpDataVersion(db, `owner:${user.email}`);
  await audit(user, 'link_added', 'affiliate_link', row?.id);
  redirect('/admin/commerce?flash=saved#links');
}

export async function toggleLinkAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const id = str(formData, 'linkId');
  if (!UUID.test(id)) redirect('/admin/commerce#links');
  const db = getDb();
  const active = formData.get('active') === '1';
  await db.update(affiliateLinks).set({ active }).where(eq(affiliateLinks.id, id));
  await bumpDataVersion(db, `owner:${user.email}`);
  await audit(user, active ? 'link_activated' : 'link_deactivated', 'affiliate_link', id);
  redirect('/admin/commerce?flash=saved#links');
}

export async function importConversionsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const programId = str(formData, 'programId');
  if (!UUID.test(programId)) redirect('/admin/commerce?flash=invalid#import');
  let text = String(formData.get('csv') ?? '');
  const file = formData.get('file');
  if (file && typeof file === 'object' && 'text' in file && (file as File).size > 0) {
    if ((file as File).size > 2 * 1024 * 1024) redirect('/admin/commerce?flash=invalid#import');
    text = await (file as File).text();
  }
  const parsed = parseConversions(text.slice(0, 2 * 1024 * 1024));
  if (parsed.error) redirect('/admin/commerce?flash=invalid#import');
  const r = await importConversions(getDb(), programId, parsed.rows);
  await audit(user, 'conversions_imported', 'affiliate_program', programId, { ...r, skipped: parsed.skipped });
  redirect(`/admin/commerce?flash=imported&i=${r.imported}&u=${r.updated}&s=${parsed.skipped}#import`);
}

export async function addEntryAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const kind = str(formData, 'kind') as (typeof KINDS)[number];
  const amount = Number(str(formData, 'amount').replace(',', '.'));
  const currency = str(formData, 'currency', 3).toUpperCase();
  const day = str(formData, 'day', 10);
  if (!KINDS.includes(kind) || !Number.isFinite(amount) || Math.abs(amount) > 10_000_000 || !/^[A-Z]{3}$/.test(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    redirect('/admin/commerce?flash=invalid#entries');
  }
  const toolSlug = str(formData, 'tool', 80);
  const [row] = await getDb()
    .insert(revenueEntries)
    .values({ kind, amountCents: Math.round(amount * 100), currency, day, description: str(formData, 'description', 300) || null, toolId: toolSlug ? await toolIdBySlug(toolSlug) : null, createdBy: `owner:${user.email}` })
    .returning({ id: revenueEntries.id });
  await audit(user, 'revenue_entry_added', 'revenue_entry', row?.id);
  redirect('/admin/commerce?flash=saved#entries');
}

export async function leadStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('editor');
  const id = str(formData, 'leadId');
  const status = str(formData, 'status') as (typeof LEAD_STATUS)[number];
  const value = str(formData, 'value');
  if (!UUID.test(id) || !LEAD_STATUS.includes(status)) redirect('/admin/commerce?flash=invalid#leads');
  await getDb()
    .update(leads)
    .set({ status, valueCents: value ? Math.round(Number(value.replace(',', '.')) * 100) : undefined })
    .where(eq(leads.id, id));
  await audit(user, 'lead_status', 'lead', id, { status });
  redirect('/admin/commerce?flash=saved#leads');
}

export async function addPlacementAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const toolId = await toolIdBySlug(str(formData, 'tool', 80));
  const slot = str(formData, 'slot') as PlacementSlot;
  const nl = str(formData, 'messageNl', 160);
  const en = str(formData, 'messageEn', 160);
  const starts = new Date(`${str(formData, 'startsAt', 10)}T00:00:00Z`);
  const ends = new Date(`${str(formData, 'endsAt', 10)}T23:59:59Z`);
  const price = str(formData, 'price');
  if (!toolId || !PLACEMENT_SLOTS.includes(slot) || (!nl && !en) || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    redirect('/admin/commerce?flash=invalid#placements');
  }
  const db = getDb();
  const [row] = await db
    .insert(placements)
    .values({
      toolId,
      slot,
      message: { ...(nl ? { nl } : {}), ...(en ? { en } : {}) },
      startsAt: starts,
      endsAt: ends,
      priceCents: price ? Math.round(Number(price.replace(',', '.')) * 100) : null,
      currency: 'EUR',
      status: 'scheduled',
      notes: str(formData, 'notes', 300) || null,
    })
    .returning({ id: placements.id });
  await bumpDataVersion(db, `owner:${user.email}`);
  await audit(user, 'placement_added', 'placement', row?.id, { slot });
  redirect('/admin/commerce?flash=saved#placements');
}

export async function cancelPlacementAction(formData: FormData): Promise<void> {
  const user = await requireAdmin('owner');
  const id = str(formData, 'placementId');
  if (!UUID.test(id)) redirect('/admin/commerce#placements');
  const db = getDb();
  await db.update(placements).set({ status: 'cancelled' }).where(eq(placements.id, id));
  await bumpDataVersion(db, `owner:${user.email}`);
  await audit(user, 'placement_cancelled', 'placement', id);
  redirect('/admin/commerce?flash=saved#placements');
}
