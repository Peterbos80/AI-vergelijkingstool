import { fallbackChain, type Locale } from '@/i18n/config';
import type { ChangeKind } from '@/lib/db/schema';
import type { IconName } from '@/components/ui/Icon';
import type { CatalogEvent } from './types';

/** One icon per kind of change (components/ui/Icon); always shown next to the event's text. */
export const EVENT_ICON: Record<ChangeKind, IconName> = {
  price_increase: 'trending-up',
  price_decrease: 'trending-down',
  plan_added: 'list-plus',
  plan_removed: 'list-minus',
  free_tier_added: 'gift',
  free_tier_removed: 'circle-slash',
  feature: 'square-plus',
  release: 'tag',
  status_change: 'refresh-cw',
  rename: 'tag',
  shutdown: 'power-off',
  new_tool: 'square-plus',
  website_down: 'unplug',
  website_up: 'plug',
  buzz: 'activity',
  video: 'play',
  policy: 'newspaper',
  funding: 'newspaper',
  acquisition: 'newspaper',
  news: 'newspaper',
};

/**
 * Direction of a change for the user, as colour (--price-up / --price-down):
 * worse (a price rises, a free plan or the tool goes) or better. Never the only signal.
 */
export const EVENT_TONE: Partial<Record<ChangeKind, 'up' | 'down'>> = {
  price_increase: 'up',
  free_tier_removed: 'up',
  shutdown: 'up',
  price_decrease: 'down',
  free_tier_added: 'down',
};

/** Tailwind text colour for an event icon. */
export function eventToneClass(kind: ChangeKind): string {
  const tone = EVENT_TONE[kind];
  return tone === 'up' ? 'text-price-up' : tone === 'down' ? 'text-price-down' : 'text-ink-3';
}

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
