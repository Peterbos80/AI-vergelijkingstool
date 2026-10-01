import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { href } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';

/** The one question: "What are you trying to do?" (GET form, works without JS). */
export function MatchForm({
  locale,
  t,
  defaultValue,
  compact = false,
  autoFocus = false,
}: {
  locale: Locale;
  t: Translator;
  defaultValue?: string;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <form method="get" action={href.match(locale)} role="search" className="w-full">
      <label htmlFor="match-q" className={compact ? 'visually-hidden' : 'label'}>
        {t('match.inputLabel')}
      </label>
      <div className="flex gap-2">
        <input
          id="match-q"
          name="q"
          type="text"
          required
          minLength={3}
          maxLength={300}
          defaultValue={defaultValue}
          placeholder={t('match.placeholder')}
          className={`input ${compact ? '' : 'min-h-14 text-lg'}`}
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="go"
        />
        <button type="submit" className={`btn ${compact ? '' : 'min-h-14 px-6 text-base'}`}>
          {t('match.submit')} <Icon name="corner-down-left" size={16} />
        </button>
      </div>
    </form>
  );
}
