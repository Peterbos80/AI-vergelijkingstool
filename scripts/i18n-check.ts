/**
 * i18n coverage report. Fails (exit 1) when a live locale misses UI keys;
 * reports coverage for configured-but-dark locales (gate for going live).
 */
import './_env';
import { enabledLocales, LOCALES } from '../src/i18n/config';
import { flattenKeys } from '../src/i18n/format';
import { MESSAGES } from '../src/i18n/server';

const reference = new Set(flattenKeys(MESSAGES.en));
let failed = false;
for (const locale of LOCALES) {
  const keys = new Set(flattenKeys(MESSAGES[locale]));
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  const coverage = ((reference.size - missing.length) / reference.size) * 100;
  const live = enabledLocales().includes(locale);
  console.log(`${locale}${live ? ' (live)' : ''}: ${coverage.toFixed(1)}% of ${reference.size} keys${extra.length ? `, ${extra.length} unknown keys` : ''}`);
  if (live && missing.length) {
    failed = true;
    console.log(`  missing: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' …' : ''}`);
  }
  if (extra.length) console.log(`  unknown: ${extra.slice(0, 10).join(', ')}`);
}
if (failed) process.exitCode = 1;
