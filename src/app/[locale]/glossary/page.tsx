import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { GLOSSARY, glossaryText } from '@/content/glossary';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { JsonLd } from '@/components/ui/JsonLd';
import { LevelTabs } from '@/components/level/LevelTabs';

export async function generateMetadata({ params }: PageProps<'/[locale]/glossary'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('glossary.metaTitle'), description: t('glossary.metaDescription'), alternates: alternates(locale, (l) => href.glossary(l)) };
}

/** AI terms in plain language; technical terms show in the Advanced view. */
export default async function GlossaryPage({ params }: PageProps<'/[locale]/glossary'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  await track({ path: href.glossary(locale), pageType: 'learn', locale });
  const terms = GLOSSARY.map((g) => ({ g, x: glossaryText(g, locale) }))
    .filter((e): e is { g: (typeof GLOSSARY)[number]; x: { term: string; def: string } } => Boolean(e.x))
    .sort((a, b) => a.x.term.localeCompare(b.x.term, locale));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: t('glossary.title'),
    hasDefinedTerm: terms.map(({ x }) => ({ '@type': 'DefinedTerm', name: x.term, description: x.def })),
  };
  return (
    <div className="container-page py-10">
      <JsonLd data={ld} />
      <h1 className="text-3xl md:text-4xl">{t('glossary.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('glossary.intro')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <LevelTabs
          controls="glossary-terms"
          labels={{ group: t('hub.levelGroup'), basis: t('hub.levelBasis'), advanced: t('hub.levelAdvanced'), basisHint: t('hub.levelBasisHint'), advancedHint: t('hub.levelAdvancedHint') }}
        />
        <p className="only-basis text-sm text-ink-3">{t('glossary.basisNote')}</p>
      </div>
      <dl id="glossary-terms" className="mt-8 grid gap-x-10 md:grid-cols-2">
        {terms.map(({ g, x }) => (
          <div key={g.id} id={g.id} className={`border-b border-line py-4 ${g.advanced ? 'only-advanced' : ''}`}>
            <dt className="font-semibold text-ink">{x.term}</dt>
            <dd className="mt-1 text-sm text-ink-2">{x.def}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-sm">
        <Link href={href.learn(locale)}>← {t('learn.title')}</Link>
      </p>
    </div>
  );
}
