import '../_env';
import { closeDb, getDb } from '../../src/lib/db/client';
import { loadCatalog } from '../../src/lib/catalog/load';
async function main() {
  const catalog = await loadCatalog(getDb(), 0);
  const cap = process.argv[2]!;
  for (const t of catalog.tools.filter((x) => x.capabilities.some((c) => c.id === cap))) {
    const s = t.capabilities.find((c) => c.id === cap)!.strength;
    console.log(t.slug.padEnd(22), s.padEnd(9), t.skillLevel.padEnd(12), 'conf', t.confidence, t.freshness, t.pricingStatus, 'free', t.hasFreeTier, 'entry', t.entryPriceCents, t.entryPriceCurrency, 'caps', t.capabilities.map((c) => c.id + (c.strength === 'primary' ? '*' : '')).join(','));
  }
}
main().finally(() => closeDb());
