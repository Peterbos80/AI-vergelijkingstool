import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT, pickMessages } from '@/i18n/server';
import { getCatalog } from '@/lib/catalog';
import { buildMeter, METERS } from '@/lib/compare/usage';
import { buildTeam } from '@/lib/compare/team';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { track } from '@/lib/analytics/track';
import { CostsHub } from '@/components/compare/CostsHub';

export async function generateMetadata({ params }: PageProps<'/[locale]/costs'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: t('costs.metaTitle'), description: t('costs.metaDescription'), alternates: alternates(locale, (l) => href.costs(l)) };
}

/**
 * "Wat kost AI voor jouw gebruik?": every usage meter and the team costs.
 * The numbers are computed from sourced plans at render time; the browser
 * only recomputes them for the visitor's input (static edition: no server).
 */
export default async function CostsPage({ params }: PageProps<'/[locale]/costs'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const catalog = await getCatalog();
  await track({ path: href.costs(locale), pageType: 'costs', locale });
  const meters = METERS.map((m) => buildMeter(catalog, m));
  const team = buildTeam(catalog);
  const messages = pickMessages(locale, ['costs', 'status']);
  const how = ['limits', 'cheapest', 'overage', 'fx', 'receipts'] as const;
  const labels = [
    { id: 'label-cheapest', key: 'cheapest' },
    { id: 'label-truly-free', key: 'trulyFree' },
    { id: 'label-european', key: 'european' },
  ] as const;

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('costs.title')}</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">{t('costs.intro')}</p>

      <div className="mt-8">
        <CostsHub meters={meters} team={team} locale={locale} messages={messages} />
      </div>

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="costs-how">
          <h2 id="costs-how" className="text-xl">
            {t('costs.how.title')}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-2">
            {how.map((k) => (
              <li key={k}>{t(`costs.how.${k}`)}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="costs-labels">
          <h2 id="costs-labels" className="text-xl">
            {t('costs.labels.title')}
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            {labels.map((l) => (
              <div key={l.id} id={l.id} className="scroll-mt-24">
                <dt className="font-semibold">{t(`costs.labels.${l.key}Name`)}</dt>
                <dd className="mt-0.5 text-ink-2">{t(`costs.labels.${l.key}`)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
