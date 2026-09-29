/**
 * Server-side i18n: message catalogs are bundled JSON; UI strings never live
 * in components. Missing keys fall back along the locale chain (→ en → nl).
 */
import { fallbackChain, LOCALE_META, type Locale } from './config';
import { createTranslator, type MessageTree, type Translator } from './format';
import nl from './messages/nl.json';
import en from './messages/en.json';
import de from './messages/de.json';
import fr from './messages/fr.json';

export const MESSAGES: Record<Locale, MessageTree> = {
  nl: nl as MessageTree,
  en: en as MessageTree,
  de: de as MessageTree,
  fr: fr as MessageTree,
};

const cache = new Map<Locale, Translator>();

export function getT(locale: Locale): Translator {
  const hit = cache.get(locale);
  if (hit) return hit;
  const chain = fallbackChain(locale);
  const t = createTranslator(
    locale,
    LOCALE_META[locale].intl,
    MESSAGES[locale],
    chain.slice(1).map((l) => MESSAGES[l]),
  );
  cache.set(locale, t);
  return t;
}

/** Pick sub-trees for client components (keeps client bundles small). */
export function pickMessages(locale: Locale, namespaces: string[]): MessageTree {
  const chain = fallbackChain(locale);
  const out: MessageTree = {};
  for (const ns of namespaces) {
    for (const l of [...chain].reverse()) {
      const tree = MESSAGES[l][ns];
      if (tree && typeof tree === 'object') out[ns] = deepMerge((out[ns] as MessageTree) ?? {}, tree);
    }
  }
  return out;
}

function deepMerge(base: MessageTree, over: MessageTree): MessageTree {
  const out: MessageTree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const prev = out[k];
    out[k] = typeof v === 'object' && typeof prev === 'object' ? deepMerge(prev, v) : v;
  }
  return out;
}
