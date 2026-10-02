import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { nameOf } from '@/lib/catalog/helpers';
import type { Catalog } from '@/lib/catalog/types';
import { parseFilters, searchTools } from '@/lib/engine/search';
import { href } from '@/lib/routes';
import { ToolRow } from '@/components/data/ToolRow';

type SP = Record<string, string | string[] | undefined>;
const PLATFORMS = ['web', 'ios', 'android', 'windows', 'macos', 'linux', 'api', 'chrome_extension'];
/** Results shown before "Show all": a list of 230+ rows is a long scroll, most visitors filter first. */
const FIRST = 48;

/** The same search with every result: the current query plus rows=all ("all" already means "also discontinued"). */
function allHref(base: string, sp: SP): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) if (k !== 'rows') q.append(k, x);
  q.set('rows', 'all');
  return `${base}?${q.toString()}`;
}

/** The explorer page body (filters + results), shared by the server page and the static edition. */
export function ExplorerView({ locale, t, catalog, sp }: { locale: Locale; t: Translator; catalog: Catalog; sp: SP }) {
  const filters = parseFilters(sp, catalog, locale);
  const hits = searchTools(catalog, filters, locale);
  const shown = sp.rows === 'all' ? hits : hits.slice(0, FIRST);

  const selectedCategory = filters.category ? catalog.categoriesById.get(filters.category) : undefined;
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('explorer.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('explorer.intro')}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside aria-labelledby="filters-heading">
          <h2 id="filters-heading" className="eyebrow">
            {t('explorer.filters')}
          </h2>
          <form method="get" action={href.tools(locale)} className="mt-3 space-y-4">
            <div>
              <label htmlFor="f-q" className="label">
                {t('explorer.search')}
              </label>
              <input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder={t('explorer.searchPlaceholder')} className="input" />
            </div>
            <div>
              <label htmlFor="f-category" className="label">
                {t('explorer.category')}
              </label>
              <select id="f-category" name="category" defaultValue={selectedCategory ? nameOf(selectedCategory, locale).slug : ''} className="input">
                <option value="">{t('explorer.any')}</option>
                {catalog.categories.map((c) => (
                  <option key={c.id} value={nameOf(c, locale).slug}>
                    {nameOf(c, locale).name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-capability" className="label">
                {t('explorer.capability')}
              </label>
              <select
                id="f-capability"
                name="capability"
                defaultValue={filters.capability ? nameOf(catalog.capabilitiesById.get(filters.capability)!, locale).slug : ''}
                className="input"
              >
                <option value="">{t('explorer.any')}</option>
                {catalog.categories.map((cat) => (
                  <optgroup key={cat.id} label={nameOf(cat, locale).name}>
                    {catalog.capabilities
                      .filter((c) => c.categoryId === cat.id)
                      .map((c) => (
                        <option key={c.id} value={nameOf(c, locale).slug}>
                          {nameOf(c, locale).name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-price" className="label">
                {t('explorer.price')}
              </label>
              <select id="f-price" name="price" defaultValue={filters.price ?? ''} className="input">
                <option value="">{t('explorer.any')}</option>
                <option value="free">{t('explorer.priceFree')}</option>
                <option value="freemium">{t('explorer.priceFreemium')}</option>
                <option value="paid">{t('explorer.pricePaid')}</option>
                <option value="open_source">{t('explorer.priceOpenSource')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-platform" className="label">
                {t('explorer.platform')}
              </label>
              <select id="f-platform" name="platform" defaultValue={filters.platform ?? ''} className="input">
                <option value="">{t('explorer.any')}</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {t(`platforms.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-level" className="label">
                {t('explorer.level')}
              </label>
              <select id="f-level" name="level" defaultValue={filters.level ?? ''} className="input">
                <option value="">{t('explorer.any')}</option>
                <option value="beginner">{t('skill.beginner')}</option>
                <option value="intermediate">{t('skill.intermediate')}</option>
                <option value="advanced">{t('skill.advanced')}</option>
              </select>
            </div>
            <fieldset className="space-y-2 text-sm">
              {(
                [
                  ['api', filters.api, 'explorer.api'],
                  ['os', filters.openSource, 'explorer.openSource'],
                  ['eu', filters.eu, 'explorer.eu'],
                  ['nl', filters.dutch, 'explorer.dutch'],
                  ['all', filters.includeDiscontinued, 'explorer.includeDiscontinued'],
                ] as const
              ).map(([name, checked, label]) => (
                <label key={name} className="flex items-center gap-2">
                  <input type="checkbox" name={name} value="1" defaultChecked={Boolean(checked)} className="h-4 w-4 accent-[var(--ink)]" />
                  {t(label)}
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor="f-sort" className="label">
                {t('explorer.sort')}
              </label>
              <select id="f-sort" name="sort" defaultValue={filters.sort ?? ''} className="input">
                <option value="">{filters.q ? t('explorer.sortRelevance') : t('explorer.sortName')}</option>
                <option value="name">{t('explorer.sortName')}</option>
                <option value="price">{t('explorer.sortPrice')}</option>
                <option value="fresh">{t('explorer.sortFresh')}</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn">
                {t('explorer.apply')}
              </button>
              <Link href={href.tools(locale)} className="text-sm text-ink-2">
                {t('explorer.reset')}
              </Link>
            </div>
          </form>
        </aside>

        <section aria-labelledby="results-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="results-heading" className="text-lg" aria-live="polite">
              {t('explorer.results', { count: hits.length })}
            </h2>
            <p className="text-xs text-ink-3">{t('explorer.rankingNote')}</p>
          </div>
          {hits.length === 0 ? (
            <div className="card mt-4 p-8">
              <p className="font-semibold">{t('explorer.emptyTitle')}</p>
              <p className="mt-1 text-ink-2">{t('explorer.emptyBody')}</p>
              <Link href={href.home(locale)} className="btn mt-4">
                {t('explorer.emptyCta')}
              </Link>
            </div>
          ) : (
            <>
              <form id="compare-form" method="get" action={href.compare(locale)} className="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" className="btn btn-ghost btn-sm">
                  {t('explorer.compareSelected')}
                </button>
                <span className="text-xs text-ink-3">{t('explorer.compareHint')}</span>
              </form>
              <ul className="card mt-3 px-4">
                {shown.map((h) => (
                  <ToolRow key={h.tool.id} tool={h.tool} catalog={catalog} t={t} locale={locale} compareFormId="compare-form" />
                ))}
              </ul>
              {shown.length < hits.length && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-3">{t('explorer.showing', { shown: shown.length, count: hits.length })}</p>
                  <Link href={allHref(href.tools(locale), sp)} className="btn btn-ghost" scroll={false}>
                    {t('explorer.showAll', { count: hits.length })}
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
