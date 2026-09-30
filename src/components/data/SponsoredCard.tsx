import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { href } from '@/lib/routes';
import { localized } from '@/lib/catalog/events';

/** A paid placement: always labelled, always separate from recommendations, rel="sponsored". */
export function SponsoredCard({ tool, message, t, locale }: { tool: { slug: string; name: string }; message: Partial<Record<string, string>>; t: Translator; locale: Locale }) {
  const text = localized(message, locale);
  if (!text) return null;
  return (
    <aside aria-label={t('sponsored.label')} className="card flex flex-col gap-3 bg-sponsored-bg p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="eyebrow">{t('sponsored.label')}</p>
        <p className="mt-1 font-semibold">{text}</p>
        <p className="mt-1 text-xs text-ink-3">
          {t('sponsored.note')}{' '}
          <Link href={href.page(locale, 'disclosure')} className="underline">
            {t('sponsored.why')}
          </Link>
        </p>
      </div>
      <a href={href.go(tool.slug, { src: 'sponsored', l: locale })} rel="sponsored noopener" className="btn btn-ghost shrink-0">
        {t('sponsored.cta', { tool: tool.name })}
      </a>
    </aside>
  );
}
