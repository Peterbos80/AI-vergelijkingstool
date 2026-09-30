import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate } from '@/i18n/formatters';
import { newsPerson, type NewsItem } from '@/lib/news';
import { href } from '@/lib/routes';

/**
 * News items as headline, outlet, date and the experts they name. The link
 * goes to the publisher: we never show the article text.
 */
export function NewsList({ items, t, locale, compact = false }: { items: NewsItem[]; t: Translator; locale: Locale; compact?: boolean }) {
  return (
    <ul className="news-list">
      {items.map((n) => (
        <li key={n.id} className="news-item" data-kind={n.kind}>
          <a href={n.url} rel="nofollow noopener noreferrer" target="_blank" className={`${compact ? 'text-sm' : 'text-base'} font-semibold no-underline hover:underline`}>
            <span aria-hidden="true">{n.kind === 'video' ? '▶ ' : ''}</span>
            {n.title}
            <span className="visually-hidden"> ({t('news.opensSource', { source: n.sourceName })})</span>
          </a>
          <p className="mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <span>{n.sourceName}</span>
            {n.publishedAt && (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={n.publishedAt.toISOString()}>{formatDate(n.publishedAt, locale)}</time>
              </>
            )}
            {n.people.map((id) => {
              const p = newsPerson(id);
              return p ? (
                <Link key={id} href={href.newsPerson(locale, id)} className="news-person">
                  {p.name}
                </Link>
              ) : null;
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}
