import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { track } from '@/lib/analytics/track';
import { CompareView } from '@/components/data/CompareView';
import { DisclosureNote } from '@/components/data/DisclosureNote';

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/compare'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  return {
    title: t('compare.metaTitle'),
    description: t('compare.metaDescription'),
    alternates: { canonical: href.compare(locale) },
    robots: Object.keys(sp).length ? { index: false, follow: true } : undefined,
  };
}

export default async function ComparePage({ params, searchParams }: PageProps<'/[locale]/compare'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = getT(locale);
  const catalog = await getCatalog();
  const raw = ([] as string[]).concat(sp.tools ?? []).flatMap((x) => x.split(','));
  const slugs = [...new Set(raw.map((s) => s.trim()).filter(Boolean))].slice(0, 4);
  const tools = slugs.map((s) => catalog.toolsBySlug.get(s)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const affiliates = await affiliateToolIds();
  await track({ path: href.compare(locale), pageType: 'compare', locale, props: { tools: tools.map((x) => x.slug) } });
  const options = catalog.tools.filter((x) => x.status !== 'shutdown');
  const slots = [0, 1, 2, 3];

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('compare.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('compare.intro')}</p>

      <form method="get" action={href.compare(locale)} className="card mt-6 p-4">
        <fieldset>
          <legend className="eyebrow">{t('compare.pick')}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {slots.map((i) => (
              <div key={i}>
                <label htmlFor={`cmp-${i}`} className="label">
                  {t('compare.toolN', { n: i + 1 })}
                </label>
                <select id={`cmp-${i}`} name="tools" defaultValue={tools[i]?.slug ?? ''} className="input">
                  <option value="">{t('compare.choose')}</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.slug}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn mt-4">
          {t('compare.submit')}
        </button>
      </form>

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
