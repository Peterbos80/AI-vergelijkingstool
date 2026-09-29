import { fallbackChain, type Locale } from '@/i18n/config';
import type { ChangeKind } from '@/lib/db/schema';
import type { CatalogEvent } from './types';

export const EVENT_ICON: Record<ChangeKind, string> = {
  price_increase: '📈',
  price_decrease: '💰',
  plan_added: '➕',
  plan_removed: '➖',
  free_tier_added: '🎁',
  free_tier_removed: '🚫',
  feature: '✨',
  release: '🚀',
  status_change: '🔁',
  rename: '🏷️',
  shutdown: '⛔',
  new_tool: '🆕',
  website_down: '🔌',
  website_up: '✅',
  buzz: '🔥',
  video: '🎬',
  policy: '📜',
  funding: '🏦',
  acquisition: '🤝',
  news: '📰',
};

export function localized(map: Partial<Record<string, string>> | null | undefined, locale: Locale): string | null {
  if (!map) return null;
  for (const l of fallbackChain(locale)) {
    const v = map[l];
    if (v) return v;
  }
  const any = Object.values(map).find(Boolean);
  return any ?? null;
}

export function eventTitle(e: CatalogEvent, locale: Locale): string {
  return localized(e.title, locale) ?? e.kind;
}

export function eventDate(e: CatalogEvent): Date {
  return e.occurredAt ?? e.detectedAt;
}
