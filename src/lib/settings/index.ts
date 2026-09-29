/**
 * Settings persistence. One JSON document per top-level key in `settings`;
 * `data_version` is a counter that invalidates in-process caches whenever
 * published data changes (see lib/cache).
 */
import { inArray, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { queryRows } from '@/lib/db/sql';
import { settings } from '@/lib/db/schema';
import { DEFAULT_SETTINGS, mergeSetting, settingsSchema, type Settings, type SettingsKey } from './defaults';

export { DEFAULT_SETTINGS, type Settings, type SettingsKey } from './defaults';

const KEYS = Object.keys(DEFAULT_SETTINGS) as SettingsKey[];

export async function loadSettings(db: Database): Promise<Settings> {
  const rows = await db.select().from(settings).where(inArray(settings.key, KEYS));
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingsKey, unknown>;
  for (const key of KEYS) out[key] = mergeSetting(key, stored.get(key));
  return out as Settings;
}

export async function saveSetting<K extends SettingsKey>(
  db: Database,
  key: K,
  value: Settings[K],
  updatedBy: string,
): Promise<Settings[K]> {
  const parsed = settingsSchema.shape[key].parse(value) as Settings[K];
  await db
    .insert(settings)
    .values({ key, value: parsed, updatedBy })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedBy, updatedAt: new Date() } });
  return parsed;
}

export const DATA_VERSION_KEY = 'data_version';

/** Increment the global data version (call after any published data change). */
export async function bumpDataVersion(db: Database, by = 'system'): Promise<number> {
  const rows = await queryRows<{ value: string | number }>(db, sql`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES (${DATA_VERSION_KEY}, '1'::jsonb, ${by}, now())
    ON CONFLICT (key) DO UPDATE
      SET value = to_jsonb(COALESCE((settings.value #>> '{}')::bigint, 0) + 1),
          updated_by = ${by}, updated_at = now()
    RETURNING (value #>> '{}')::bigint AS value
  `);
  return Number(rows[0]?.value ?? 0);
}

export async function readDataVersion(db: Database): Promise<number> {
  const rows = await queryRows<{ value: string | null }>(
    db,
    sql`SELECT value #>> '{}' AS value FROM settings WHERE key = ${DATA_VERSION_KEY}`,
  );
  return Number(rows[0]?.value ?? 0);
}
