import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { getCatalog, taskSlug, taskTextOf } from '@/lib/catalog';
import { EVENT_ICON, eventDate, eventTitle } from '@/lib/catalog/events';
import { fairFightGate } from '@/lib/engine/compare';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { emailEnabled } from '@/lib/env';
import { track } from '@/lib/analytics/track';
import { MatchForm } from '@/components/match/MatchForm';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import type { CatalogTool } from '@/lib/catalog/types';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: { absolute: t('home.metaTitle') }, description: t('meta.defaultDescription'), alternates: alternates(locale, (l) => `/${l}`) };
}

const EXAMPLE_TASKS = [
  'create-social-media-videos',
  'build-website-no-code',
  'automatic-meeting-notes',
  'long-videos-to-shorts',
  'create-product-photos',
  'customer-support-chatbot',
];

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const catalog = await getCatalog();
  await track({ path: `/${locale}`, pageType: 'home', locale });
  const s = catalog.stats;

  const examples = EXAMPLE_TASKS.map((id) => catalog.tasksById.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const changed = catalog.events.filter((e) => e.kind !== 'price_decrease').slice(0, 6);
  const cheaper = catalog.events.filter((e) => e.kind === 'price_decrease').slice(0, 4);

  // Fair Fights that pass the gate, from editorial alternative pairs.
  const fights: [CatalogTool, CatalogTool][] = [];
  const seen = new Set<string>();
  for (const tool of catalog.tools) {
    for (const alt of tool.alternatives.filter((a) => a.source === 'editorial')) {
      const other = catalog.toolsById.get(alt.id);
      if (!other) continue;
      const key = [tool.slug, other.slug].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      if (fairFightGate(tool, other).ok) fights.push([tool, other]);
    }
  }
  const popular = catalog.tasks.slice(0, 8);

  return (
    <>
      <section className="border-b border-line">
        <div className="container-page py-14 md:py-20">
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02]">{t('home.heroTitle')}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">{t('home.heroSub')}</p>
          <div className="mt-8 max-w-3xl">
            <MatchForm locale={locale} t={t} />
          </div>
          {examples.length > 0 && (
            <div className="mt-4">
              <span className="visually-hidden">{t('home.examples')}</span>
              <ul className="flex flex-wrap gap-2">
                {examples.map((task) => (
                  <li key={task.id}>
                    <Link href={href.match(locale, { q: taskTextOf(task, locale).title })} className="chip">
                      {taskTextOf(task, locale).title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.tools > 0 && (
            <p className="mono mt-8 text-xs text-ink-3">
              <span className="font-semibold text-ink-2">{t('meta.tagline')}</span>{' '}
              {t('home.proof', {
                tools: formatNumber(s.tools, locale),
                facts: formatNumber(s.facts + s.plans, locale),
                supported: Math.round(s.supportedShare * 100),
                date: formatDate(s.lastCheckAt, locale),
              })}
            </p>
          )}
        </div>
      </section>

      {(changed.length > 0 || cheaper.length > 0) && (
        <section className="container-page grid gap-10 py-12 md:grid-cols-2">
          {changed.length > 0 && (
            <div>
              <h2 className="eyebrow">{t('home.changedTitle')}</h2>
              <ul className="mt-3 divide-y divide-line">
                {changed.map((e) => {
                  const tool = e.toolId ? catalog.toolsById.get(e.toolId) : undefined;
                  return (
                    <li key={e.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                      <span>
                        <span aria-hidden="true">{EVENT_ICON[e.kind]}</span>{' '}
                        {tool ? (
                          <Link href={href.tool(locale, tool.slug)} className="font-medium">
                            {tool.name}
                          </Link>
                        ) : null}
                        {tool ? ' — ' : ''}
                        {eventTitle(e, locale)}
                      </span>
                      <span className="mono shrink-0 text-xs text-ink-3">{formatDate(eventDate(e), locale)}</span>
                    </li>
                  );
                })}
              </ul>
              <Link href={href.pulse(locale)} className="mt-3 inline-block text-sm">
                {t('home.pulseAll')} →
              </Link>
            </div>
          )}
          {cheaper.length > 0 && (
            <div>
              <h2 className="eyebrow">{t('home.cheaperTitle')}</h2>
              <ul className="mt-3 divide-y divide-line">
                {cheaper.map((e) => {
                  const tool = e.toolId ? catalog.toolsById.get(e.toolId) : undefined;
                  return (
                    <li key={e.id} className="py-2.5 text-sm">
                      {tool && (
                        <Link href={href.toolPricing(locale, tool.slug)} className="font-medium">
                          {tool.name}
                        </Link>
                      )}{' '}
                      — {eventTitle(e, locale)} <span className="mono text-xs text-ink-3">{formatDate(eventDate(e), locale)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {fights.length > 0 && (
        <section className="border-y border-line bg-card">
          <div className="container-page py-10">
            <h2 className="eyebrow">{t('home.fightsTitle')}</h2>
            <p className="mt-1 text-sm text-ink-2">{t('home.fightsSub')}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {fights.slice(0, 8).map(([a, b]) => (
                <li key={`${a.slug}-${b.slug}`}>
                  <Link href={href.fairFight(locale, a.slug, b.slug)} className="chip">
                    {a.name} vs {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="container-page py-12">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl">{t('home.tasksTitle')}</h2>
          <Link href={href.tasks(locale)} className="text-sm">
            {t('home.tasksAll')} →
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((task) => {
            const text = taskTextOf(task, locale);
            return (
              <li key={task.id}>
                <Link href={href.task(locale, taskSlug(task, locale))} className="card block h-full p-4 no-underline hover:border-ink-3">
                  <span className="font-semibold">{text.title}</span>
                  <span className="mt-1 block text-sm text-ink-2">{text.summary}</span>
                  <span className="mono mt-3 block text-xs text-ink-3">{t('home.stepsCount', { count: task.steps.length })}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border-t border-line bg-paper-2">
        <div className="container-page grid gap-8 py-12 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n}>
              <p className="mono text-xs text-ink-3">0{n}</p>
              <h2 className="mt-1 text-lg">{t(`home.how${n}Title`)}</h2>
              <p className="mt-1 text-sm text-ink-2">{t(`home.how${n}`)}</p>
            </div>
          ))}
        </div>
      </section>

      {emailEnabled() && (
        <section className="container-page py-12">
          <div className="card grid gap-6 p-6 md:grid-cols-2">
            <div>
              <h2 className="text-xl">{t('home.newsletterTitle')}</h2>
              <p className="mt-2 text-sm text-ink-2">{t('home.newsletterBody')}</p>
            </div>
            <NewsletterForm locale={locale} t={t} />
          </div>
        </section>
      )}
    </>
  );
}
