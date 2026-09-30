/**
 * Process-wide catalog cache, invalidated by the `data_version` setting.
 * The version is re-read at most every CHECK_MS; any agent or admin write that
 * changes published data bumps it (lib/settings → bumpDataVersion).
 */
import { getDb } from '@/lib/db/client';
import { readDataVersion } from '@/lib/settings';
import { loadCatalog } from './load';
import type { Catalog } from './types';

export type * from './types';

const CHECK_MS = 15_000;

interface CacheState {
  catalog: Catalog | null;
  checkedAt: number;
  loading: Promise<Catalog> | null;
}

const g = globalThis as unknown as { __aitwCatalog?: CacheState };
const state: CacheState = (g.__aitwCatalog ??= { catalog: null, checkedAt: 0, loading: null });

export async function getCatalog(): Promise<Catalog> {
  const now = Date.now();
  if (state.catalog && now - state.checkedAt < CHECK_MS) return state.catalog;
  if (state.loading) return state.loading;
  state.loading = (async () => {
    try {
      const db = getDb();
      const version = await readDataVersion(db);
      if (state.catalog && state.catalog.version === version) {
        state.checkedAt = Date.now();
        return state.catalog;
      }
      const catalog = await loadCatalog(db, version);
      state.catalog = catalog;
      state.checkedAt = Date.now();
      return catalog;
    } finally {
      state.loading = null;
    }
  })();
  return state.loading;
}

/** Drop the cache (tests, admin "refresh now"). */
export function resetCatalogCache(): void {
  state.catalog = null;
  state.checkedAt = 0;
}

export * from './helpers';
