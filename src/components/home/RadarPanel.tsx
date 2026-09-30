import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { EVENT_ICON, eventDate, eventTitle } from '@/lib/catalog/events';
import { sourceDomain, type Radar } from '@/lib/catalog/radar';
import type { Catalog } from '@/lib/catalog/types';
import { href } from '@/lib/routes';

function Column({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="radar-col">
      <h3 id={id} className="radar-title">
        <span className="live-dot" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * "AI trend and news radar": three columns of what the agents collected,
 * each item linked to its origin. Empty columns say when data arrives.
 */
export function RadarPanel({ data, catalog, t, locale }: { data: Radar; catalog: Catalog; t: Translator; locale: Locale }) {
  return (
    <section aria-labelledby="radar-title" className="hub-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="radar-title" className="text-2xl">
            <span aria-hidden="true">🔥 </span>
            {t('hub.radarTitle')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('hub.radarSub')}</p>
        </div>
        <Link href={href.pulse(locale)} className="link-accent text-sm font-semibold">
          {t('hub.radarAll')} →
        </Link>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Column id="radar-news" title={t('hub.radarNews')}>
          {data.news.length ? (
            <ul className="radar-list">
              {data.news.map((e) => {
                const tool = e.toolId ? catalog.toolsById.get(e.toolId) : undefined;
                const domain = sourceDomain(e.sourceUrl);
                return (
                  <li key={e.id} className="radar-item" data-kind={e.kind}>
                    <p className="text-sm">
                      <span aria-hidden="true">{EVENT_ICON[e.kind]} </span>
                      {tool && (
                        <Link href={href.tool(locale, tool.slug)} className="font-semibold no-underline hover:underline">
                          {tool.name}
                        </Link>
                      )}
                      {tool ? ': ' : ''}
                      {eventTitle(e, locale)}
                    </p>
                    <p className="mono mt-1 text-xs text-ink-3">
                      <time dateTime={eventDate(e).toISOString()}>{formatDate(eventDate(e), locale)}</time>
                      {domain && e.sourceUrl && (
                        <>
                          {' · '}
                          <a href={e.sourceUrl} rel="nofollow noopener noreferrer" target="_blank" className="underline">
                            {t('hub.source', { domain })}
                          </a>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="radar-empty">{t('hub.radarEmptyNews')}</p>
          )}
        </Column>

        <Column id="radar-videos" title={t('hub.radarVideos')}>
          {data.videos.length ? (
            <ul className="radar-list">
              {data.videos.map((v) => (
                <li key={`${v.id}-${v.toolSlug}`} className="radar-item radar-video">
                  <a href={v.url} rel="nofollow noopener noreferrer" target="_blank" className="text-sm font-semibold no-underline hover:underline">
                    {v.title}
                  </a>
                  <p className="mono mt-1 text-xs text-ink-3">
                    {v.channel ? `${v.channel} · ` : ''}
                    {t(`hub.videoKind.${v.kind}`)}
                    {v.publishedAt && (
                      <>
                        {' · '}
                        <time dateTime={v.publishedAt.toISOString()}>{formatDate(v.publishedAt, locale)}</time>
                      </>
                    )}
                    {' · '}
                    <Link href={href.tool(locale, v.toolSlug)} className="underline">
                      {v.toolName}
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="radar-empty">{t('hub.radarEmptyVideos')}</p>
          )}
        </Column>

        <Column id="radar-buzz" title={t('hub.radarBuzz')}>
          {data.buzz.length ? (
            <ul className="radar-list">
              {data.buzz.map((b) => (
                <li key={`${b.toolSlug}-${b.provider}`} className="radar-item">
                  <p className="text-sm">
                    <Link href={href.tool(locale, b.toolSlug)} className="font-semibold no-underline hover:underline">
                      {b.toolName}
                    </Link>
                  </p>
                  <p className="mono mt-1 text-xs text-ink-3">
                    {b.url ? (
                      <a href={b.url} rel="nofollow noopener noreferrer" target="_blank" className="underline">
                        {t(`hub.buzz.${b.provider}`, { count: b.value, n: formatNumber(b.value, locale) })}
                      </a>
                    ) : (
                      t(`hub.buzz.${b.provider}`, { count: b.value, n: formatNumber(b.value, locale) })
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="radar-empty">{t('hub.radarEmptyBuzz')}</p>
          )}
        </Column>
      </div>
    </section>
  );
}
