import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { EVENT_ICON, eventDate, eventTitle, eventToneClass } from '@/lib/catalog/events';
import { sourceDomain, type Radar } from '@/lib/catalog/radar';
import type { Catalog } from '@/lib/catalog/types';
import { newsPerson } from '@/lib/news';
import { href } from '@/lib/routes';
import { NewsList } from '@/components/news/NewsList';
import { Icon } from '@/components/ui/Icon';

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
 * "AI trend and news radar": up to three columns of what the agents
 * collected, each item linked to its origin. A column without items is left
 * out (an empty state is not content); with nothing at all, no panel.
 */
export function RadarPanel({ data, catalog, t, locale }: { data: Radar; catalog: Catalog; t: Translator; locale: Locale }) {
  const columns = [data.news, data.videos, data.changes].filter((c) => c.length > 0).length;
  if (!columns && !data.buzz.length) return null;
  return (
    <section aria-labelledby="radar-title" className="hub-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="radar-title" className="display-3">
            {t('hub.radarTitle')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('hub.radarSub')}</p>
        </div>
        <Link href={href.news(locale)} className="link-bold">
          {t('hub.radarAll')} →
        </Link>
      </div>
      <div className={`mt-5 grid gap-x-8 gap-y-6 ${columns === 3 ? 'md:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : ''}`}>
        {data.news.length > 0 && (
          <Column id="radar-news" title={t('hub.radarNews')}>
            <NewsList items={data.news} t={t} locale={locale} compact />
          </Column>
        )}

        {data.videos.length > 0 && (
          <Column id="radar-videos" title={t('hub.radarVideos')}>
            <ul className="radar-list">
              {data.videos.map((v) => (
                <li key={`${v.id}-${v.toolSlug ?? 'media'}`} className="radar-item radar-video">
                  <a href={v.url} rel="nofollow noopener noreferrer" target="_blank" className="text-sm font-semibold no-underline hover:underline">
                    <Icon name="play" size={14} className="mr-1.5 text-ink-3" />
                    {v.title}
                  </a>
                  <p className="mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                    {v.channel && <span>{v.channel}</span>}
                    {v.kind !== 'media' && <span>· {t(`hub.videoKind.${v.kind}`)}</span>}
                    {v.publishedAt && (
                      <span>
                        · <time dateTime={v.publishedAt.toISOString()}>{formatDate(v.publishedAt, locale)}</time>
                      </span>
                    )}
                    {v.toolSlug && v.toolName && (
                      <Link href={href.tool(locale, v.toolSlug)} className="underline">
                        {v.toolName}
                      </Link>
                    )}
                    {v.people.map((id) => {
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
          </Column>
        )}

        {data.changes.length > 0 && (
          <Column id="radar-changes" title={t('hub.radarChanges')}>
            <ul className="radar-list">
              {data.changes.map((e) => {
                const tool = e.toolId ? catalog.toolsById.get(e.toolId) : undefined;
                const domain = sourceDomain(e.sourceUrl);
                return (
                  <li key={e.id} className="radar-item" data-kind={e.kind}>
                    <p className="text-sm">
                      <Icon name={EVENT_ICON[e.kind]} size={16} className={`mr-1.5 ${eventToneClass(e.kind)}`} />
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
          </Column>
        )}
      </div>

      {data.buzz.length > 0 && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="radar-title">
            <span className="live-dot" aria-hidden="true" />
            {t('hub.radarBuzz')}
          </span>
          {data.buzz.map((b) => (
            <span key={`${b.toolSlug}-${b.provider}`} className="text-ink-2">
              <Link href={href.tool(locale, b.toolSlug)} className="font-semibold no-underline hover:underline">
                {b.toolName}
              </Link>{' '}
              {b.url ? (
                <a href={b.url} rel="nofollow noopener noreferrer" target="_blank" className="mono text-xs text-ink-3 underline">
                  {t(`hub.buzz.${b.provider}`, { count: b.value, n: formatNumber(b.value, locale) })}
                </a>
              ) : (
                <span className="mono text-xs text-ink-3">{t(`hub.buzz.${b.provider}`, { count: b.value, n: formatNumber(b.value, locale) })}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
