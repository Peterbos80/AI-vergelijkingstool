/**
 * Commerce data entry: affiliate programmes/links, conversion import (CSV)
 * and manual revenue entries. Imported conversions are the only source of
 * affiliate revenue; nothing is estimated into the revenue tables.
 */
import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { affiliatePrograms, conversions } from '@/lib/db/schema';

/** RFC 4180-style CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string, maxRows = 5000): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      if (rows.length > maxRows) break;
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows.slice(0, maxRows + 1);
}

export interface ConversionRow {
  externalId: string;
  occurredAt: Date;
  amountCents: number;
  currency: string;
  status: 'pending' | 'approved' | 'reversed' | 'paid';
  clickId: string | null;
  raw: Record<string, string>;
}

const STATUS_MAP: Record<string, ConversionRow['status']> = {
  pending: 'pending',
  open: 'pending',
  approved: 'approved',
  confirmed: 'approved',
  accepted: 'approved',
  reversed: 'reversed',
  rejected: 'reversed',
  declined: 'reversed',
  cancelled: 'reversed',
  canceled: 'reversed',
  paid: 'paid',
};

/** Parse and validate a conversions CSV (header row required). Invalid rows are counted, never guessed. */
export function parseConversions(text: string): { rows: ConversionRow[]; skipped: number; error?: 'no_header' } {
  const table = parseCsv(text.replace(/^\ufeff/, ''));
  if (!table.length) return { rows: [], skipped: 0, error: 'no_header' };
  const header = table[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = { id: col('external_id'), at: col('occurred_at'), amount: col('amount'), currency: col('currency'), status: col('status'), click: col('click_id') };
  if (idx.id < 0 || idx.at < 0 || idx.amount < 0 || idx.currency < 0) return { rows: [], skipped: 0, error: 'no_header' };
  const rows: ConversionRow[] = [];
  let skipped = 0;
  for (const r of table.slice(1)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const externalId = get(idx.id).slice(0, 200);
    const occurredAt = new Date(get(idx.at));
    const amountRaw = get(idx.amount).replace(/[^\d,.-]/g, '');
    const amount = Number(/,\d{1,2}$/.test(amountRaw) ? amountRaw.replace(/\./g, '').replace(',', '.') : amountRaw.replace(/,/g, ''));
    const currency = get(idx.currency).toUpperCase();
    const status = STATUS_MAP[get(idx.status).toLowerCase()] ?? (idx.status < 0 ? 'approved' : undefined);
    const click = get(idx.click);
    if (!externalId || Number.isNaN(occurredAt.getTime()) || !Number.isFinite(amount) || Math.abs(amount) > 1_000_000 || !/^[A-Z]{3}$/.test(currency) || !status) {
      skipped++;
      continue;
    }
    rows.push({
      externalId,
      occurredAt,
      amountCents: Math.round(amount * 100),
      currency,
      status,
      clickId: /^[0-9A-Z]{26}$/.test(click) ? click : null,
      raw: Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').slice(0, 200)])),
    });
  }
  return { rows, skipped };
}

export async function importConversions(db: Database, programId: string, rows: ConversionRow[]): Promise<{ imported: number; updated: number }> {
  const [program] = await db.select().from(affiliatePrograms).where(eq(affiliatePrograms.id, programId));
  if (!program) return { imported: 0, updated: 0 };
  let imported = 0;
  let updated = 0;
  const now = new Date();
  for (const r of rows) {
    const [existing] = await db
      .select({ id: conversions.id })
      .from(conversions)
      .where(and(eq(conversions.programId, programId), eq(conversions.externalId, r.externalId)));
    if (existing) {
      await db.update(conversions).set({ status: r.status, amountCents: r.amountCents, currency: r.currency, importedAt: now, raw: r.raw }).where(eq(conversions.id, existing.id));
      updated++;
    } else {
      await db.insert(conversions).values({
        clickId: r.clickId,
        programId,
        toolId: program.toolId,
        externalId: r.externalId,
        occurredAt: r.occurredAt,
        amountCents: r.amountCents,
        currency: r.currency,
        status: r.status,
        source: 'csv',
        importedAt: now,
        raw: r.raw,
      });
      imported++;
    }
  }
  await db.update(affiliatePrograms).set({ lastCheckedAt: now }).where(eq(affiliatePrograms.id, programId));
  return { imported, updated };
}
