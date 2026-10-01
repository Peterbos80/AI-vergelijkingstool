import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { toolWorld } from '@/lib/catalog/helpers';
import { pickDuels } from '@/lib/catalog/duels';
import type { Catalog } from '@/lib/catalog/types';
import { href } from '@/lib/routes';
import { CompareView } from '@/components/data/CompareView';
import { DisclosureNote } from '@/components/data/DisclosureNote';
import { Icon } from '@/components/ui/Icon';
import { ToolMark } from '@/components/data/ToolMark';
import { ToolChooser } from '@/components/compare/ToolChooser';
import { chooserData } from '@/components/compare/chooser-data';

type SP = Record<string, string | string[] | undefined>;

/** The compare page body (pick up to four tools), shared by the server page and the static edition. */
export function ComparePicker({
  locale,
  t,
  catalog,
  sp,
  affiliates,
}: {
  locale: Locale;
  t: Translator;
  catalog: Catalog;
  sp: SP;
  affiliates: Set<string>;
}) {
  const raw = ([] as string[]).concat(sp.tools ?? []).flatMap((x) => x.split(','));
  const slugs = [...new Set(raw.map((s) => s.trim()).filter(Boolean))].slice(0, 4);
  const tools = slugs.map((s) => catalog.toolsBySlug.get(s)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const { tools: chooserTools, worlds: chooserWorlds } = chooserData(catalog, t, locale);
  const duels = pickDuels(catalog, 6);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('compare.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('compare.intro')}</p>

      {duels.length > 0 && (
        <section aria-labelledby="cmp-popular" className="mt-6">
          <h2 id="cmp-popular" className="eyebrow">
            {t('compare.pickerPopular')}
          </h2>
          <ul className="duel-chips">
            {duels.map(([a, b]) => (
              <li key={`${a.slug}-${b.slug}`}>
                <Link href={href.fairFight(locale, a.slug, b.slug)} className="duel-chip">
                  <ToolMark tool={a} world={toolWorld(a, catalog)} size={22} />
                  <ToolMark tool={b} world={toolWorld(b, catalog)} size={22} />
                  <span>
                    {a.name} <span className="text-ink-3">vs</span> {b.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="chooser-box" open={tools.length < 2}>
        <summary className="chooser-summary">
          <span>{tools.length < 2 ? t('compare.pickerLegend') : t('compare.pickerChange')}</span>
          <Icon name="chevron-down" size={18} className="chooser-chevron" />
        </summary>
        <ToolChooser
          action={href.compare(locale)}
          tools={chooserTools}
          worlds={chooserWorlds}
          selected={tools.map((x) => x.slug)}
          labels={{
            legend: t('compare.pickerLegend'),
            search: t('compare.pickerSearch'),
            searchPlaceholder: t('compare.pickerSearchPlaceholder'),
            worlds: t('compare.pickerWorlds'),
            all: t('compare.pickerAll'),
            chosen: t('compare.pickerChosen'),
            empty: t('compare.pickerEmpty'),
            remove: t('compare.pickerRemove'),
            suggest: t('compare.pickerSuggest'),
            full: t('compare.pickerFull'),
            noResults: t('compare.pickerNoResults'),
            submit: [0, 1, 2, 3, 4].map((n) => t('compare.pickerSubmit', { count: n })),
            submitPlain: t('compare.submit'),
          }}
        />
      </details>

      {tools.length < 2 ? (
        <p className="mt-8 text-ink-2">{t('compare.needTwo')}</p>
      ) : (
        <>
          {tools.some((x) => affiliates.has(x.id)) && (
            <div className="mt-6">
              <DisclosureNote t={t} locale={locale} />
            </div>
          )}
          <CompareView tools={tools} catalog={catalog} t={t} locale={locale} affiliates={affiliates} src="compare" />
        </>
      )}
      <p className="mt-10 text-sm text-ink-2">
        {t('compare.shareMatch')} <Link href={href.home(locale)}>{t('compare.matchCta')} →</Link>
      </p>
    </div>
  );
}
