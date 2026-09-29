import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { href } from '@/lib/routes';

/**
 * Outbound link via /go (click tracking). Affiliate links are labelled and
 * marked rel="sponsored" (docs/strategy/09 §4).
 */
export function VisitLink({
  slug,
  name,
  t,
  locale,
  src,
  pos,
  affiliate,
  variant = 'primary',
  mq,
}: {
  slug: string;
  name: string;
  t: Translator;
  locale: Locale;
  src: string;
  pos?: number;
  affiliate: boolean;
  variant?: 'primary' | 'ghost' | 'small';
  mq?: string;
}) {
  const cls = variant === 'primary' ? 'btn' : variant === 'ghost' ? 'btn btn-ghost' : 'btn btn-ghost btn-sm';
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <a
        href={href.go(slug, { src, pos, l: locale, mq })}
        className={cls}
        rel={affiliate ? 'sponsored nofollow' : 'nofollow'}
        data-affiliate={affiliate ? '1' : undefined}
      >
        {t('tool.visit', { name })} <span aria-hidden="true">↗</span>
      </a>
      {affiliate && <span className="mono text-[0.6875rem] text-ink-3">{t('tool.affiliateLabel')}</span>}
    </span>
  );
}
