/**
 * One-shot status messages after admin actions, passed as ?flash=<key>.
 * Only whitelisted keys are rendered (no reflected text from the URL).
 */
import type { Translator } from '@/i18n/format';

const KEYS = ['saved', 'done', 'reverted', 'conflict', 'notReversible', 'already', 'forbidden', 'csrf', 'readOnly'] as const;

export function flashMessage(sp: Record<string, string | string[] | undefined>, t: Translator): { text: string; tone: 'ok' | 'fail' | 'warn' } | null {
  const key = typeof sp.flash === 'string' ? sp.flash : null;
  if (!key) return null;
  const num = (k: string) => (typeof sp[k] === 'string' && /^\d{1,7}$/.test(sp[k] as string) ? Number(sp[k]) : 0);
  if (key === 'imported') return { text: t('admin.commerce.imported', { imported: num('i'), updated: num('u'), skipped: num('s') }), tone: 'ok' };
  if (key === 'revertedRun') return { text: t('admin.operations.revertedRun', { reverted: num('r'), skipped: num('s') }), tone: 'ok' };
  if (key === 'started') return { text: t('admin.operations.started'), tone: 'ok' };
  if (key === 'draftCreated') return { text: t('admin.tools.created'), tone: 'ok' };
  if (key === 'publishBlocked') return { text: t('admin.tools.publishBlocked', { reasons: t('admin.tools.gateGeneric') }), tone: 'warn' };
  if (key === 'invalid') return { text: t('admin.automation.invalid', { message: t('admin.common.checkInput') }), tone: 'fail' };
  if ((KEYS as readonly string[]).includes(key)) {
    const tone = key === 'conflict' || key === 'forbidden' || key === 'notReversible' || key === 'csrf' ? 'fail' : key === 'already' || key === 'readOnly' ? 'warn' : 'ok';
    return { text: t(`admin.common.${key}`), tone };
  }
  return null;
}
