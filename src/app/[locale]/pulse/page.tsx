import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate } from '@/i18n/formatters';
import { getCatalog } from '@/lib/catalog';
import { EVENT_ICON, eventDate, eventTitle, eventToneClass, localized } from '@/lib/catalog/events';
import type { ChangeKind } from '@/lib/db/schema';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { Icon } from '@/components/ui/Icon';

const GROUPS: Record<string, ChangeKind[]> = {
  price: ['price_increase', 'price_decrease'],
  plans: ['plan_added', 'plan_removed', 'free_tier_added', 'free_tier_removed'],
  product: ['feature', 'release', 'rename', 'new_tool', 'video'],
  status: ['status_change', 'shutdown', 'website_down', 'website_up'],
  news: ['news', 'policy', 'funding', 'acquisition', 'buzz'],
};

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/pulse'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  return {
    title: t('pulse.metaTitle'),
    description: t('pulse.metaDescription'),
    alternates: alternates(locale, (l) => href.pulse(l)),
    robots: sp.type ? { index: false, follow: true } : undefined,
  };
}

export default async function PulsePage({ params, searchParams }: PageProps<'/[locale]/pulse'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  const catalog = await getCatalog();
  await track({ path: href.pulse(locale), pageType: 'pulse', locale });
  const type = typeof sp.type === 'string' && sp.type in GROUPS ? sp.type : null;
  const events = catalog.events.filter((e) => !type || GROUPS[type]!.includes(e.kind));
  const byMonth = new Map<string, typeof events>();
  for (const e of events) {
    const d = eventDate(e);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
  }
  const monthName = (key: string) =>
    new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`));
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('pulse.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('pulse.intro')}</p>
      <nav aria-label={t('pulse.filter')} className="mt-6">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href={href.pulse(locale)} aria-current={!type ? 'true' : undefined} className={`chip ${!type ? 'chip-active' : ''}`}>
              {t('pulse.all')}
            </Link>
          </li>
          {Object.keys(GROUPS).map((g) => (
            <li key={g}>
              <Link href={href.pulse(locale, { type: g })} aria-current={type === g ? 'true' : undefined} className={`chip ${type === g ? 'chip-active' : ''}`}>
                {t(`pulse.types.${g}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {events.length === 0 ? (
        <p className="mt-8 text-ink-2">{t('pulse.empty')}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {[...byMonth.entries()].map(([month, list]) => (
            <section key={month} aria-labelledby={`m-${month}`}>
              <h2 id={`m-${month}`} className="eyebrow">
                {monthName(month)}
              </h2>
              <ol className="mt-3 divide-y divide-line border-y border-line">
                {list.map((e) => {
                  const tool = e.toolId ? catalog.toolsById.get(e.toolId) : undefined;
                  const summary = localized(e.summary, locale);
                  return (
                    <li key={e.id} className="grid gap-1 py-4 md:grid-cols-[8rem_1fr]">
                      <p className="mono text-xs text-ink-3">
                        {e.occurredPrecision === 'month' ? monthName(month) : formatDate(eventDate(e), locale)}
                        <br />
                        {t(`eventKind.${e.kind}`)}
                      </p>
                      <div>
                        <p className="font-medium">
                          <Icon name={EVENT_ICON[e.kind]} size={16} className={`mr-1.5 ${eventToneClass(e.kind)}`} />
                          {tool && (
                            <Link href={href.tool(locale, tool.slug)} className="font-semibold">
                              {tool.name}
                            </Link>
                          )}
                          {tool ? ' — ' : ''}
                          {eventTitle(e, locale)}
                        </p>
                        {summary && <p className="mt-1 text-sm text-ink-2">{summary}</p>}
                        <p className="mt-1 text-xs text-ink-3">
                          {e.sourceUrl && (
                            <>
                              {t('pulse.source')}:{' '}
                              <a href={e.sourceUrl} rel="nofollow noopener noreferrer">
                                {new URL(e.sourceUrl).hostname.replace(/^www\./, '')}
                              </a>{' '}
                              ·{' '}
                            </>
                          )}
                          {t('pulse.detected', { date: formatDate(e.detectedAt, locale) })} · {t('receipts.confidence')} {e.confidence}/100
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
