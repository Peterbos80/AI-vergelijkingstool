import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { href } from '@/lib/routes';

/** Shown automatically on any page that renders at least one affiliate link. */
export function DisclosureNote({ t, locale }: { t: Translator; locale: Locale }) {
  return (
    <p className="notice text-ink-2" data-testid="disclosure">
      {t('disclosure.note')}{' '}
      <Link href={href.page(locale, 'methodology')} className="underline">
        {t('disclosure.howWeRank')}
      </Link>
    </p>
  );
}
