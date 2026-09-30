/**
 * Human text for inbox items, actions and statuses. Items are stored
 * locale-independently (kind, reasonCode, defaultAction, payload); these
 * helpers render them in the owner's language and fall back to the stored
 * plain title when no template exists.
 */
import type { Translator } from '@/i18n/format';
import { formatDate } from '@/i18n/formatters';
import type { Locale } from '@/i18n/config';

const has = (t: Translator, key: string) => t.has(key);

export function kindLabel(t: Translator, kind: string): string {
  return has(t, `admin.kind.${kind}`) ? t(`admin.kind.${kind}`) : kind;
}

export function reasonText(t: Translator, reasonCode: string | null, fallback: string): string {
  if (!reasonCode) return fallback;
  if (reasonCode.startsWith('dependency_')) {
    const key = reasonCode.slice('dependency_'.length);
    const name = has(t, `admin.dependency.${key}.name`) ? t(`admin.dependency.${key}.name`) : key;
    return `${t('admin.reason.dependency')} ${name}.`;
  }
  return has(t, `admin.reason.${reasonCode}`) ? t(`admin.reason.${reasonCode}`) : fallback;
}

export function defaultActionText(t: Translator, action: string | null): string {
  const key = `admin.defaultAction.${action ?? 'none'}`;
  return has(t, key) ? t(key) : (action ?? t('admin.defaultAction.none'));
}

/** "If you do nothing" line: "On 3 Oct 2026: keep the old price…". */
export function ifNothing(t: Translator, locale: Locale, action: string | null, dueAt: Date | string | null): string {
  const text = defaultActionText(t, action);
  return dueAt ? t('admin.inbox.ifNothingAt', { date: formatDate(dueAt, locale), action: text }) : t('admin.inbox.ifNothingNow', { action: text.charAt(0).toUpperCase() + text.slice(1) });
}

export function actionLabel(t: Translator, action: string): string {
  return has(t, `admin.operations.action.${action}`) ? t(`admin.operations.action.${action}`) : action.replace(/_/g, ' ');
}

export function dependencyName(t: Translator, key: string): string {
  return has(t, `admin.dependency.${key}.name`) ? t(`admin.dependency.${key}.name`) : key;
}

export function dependencyAction(t: Translator, key: string): string {
  return has(t, `admin.dependency.${key}.action`) ? t(`admin.dependency.${key}.action`) : '';
}
