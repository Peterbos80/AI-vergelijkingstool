/**
 * Localized text for events and items created by agents. Templates live in
 * the message catalogs (namespace `agentEvent`), never in agent code; stored
 * for every configured locale so a locale can go live without backfilling.
 */
import { LOCALES, type Locale } from '@/i18n/config';
import type { Vars } from '@/i18n/format';
import { getT } from '@/i18n/server';
import type { LocalizedText } from '@/lib/db/schema';

export const CONTENT_LOCALES: readonly Locale[] = LOCALES;

export function eventText(key: string, vars: Vars | ((locale: Locale) => Vars) = {}): LocalizedText {
  const out: LocalizedText = {};
  for (const l of CONTENT_LOCALES) out[l] = getT(l)(`agentEvent.${key}`, typeof vars === 'function' ? vars(l) : vars);
  return out;
}
