import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { getCatalog, taskSlug, taskTextOf } from '@/lib/catalog';
import { radar, type Radar } from '@/lib/catalog/radar';
import { getDb } from '@/lib/db/client';
import { logError } from '@/lib/ops/errors';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { emailEnabled } from '@/lib/env';
import { track } from '@/lib/analytics/track';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import { SponsoredCard } from '@/components/data/SponsoredCard';
import { AskBox, type AskChoice, type AskPrompt } from '@/components/home/AskBox';
import { RadarPanel } from '@/components/home/RadarPanel';
import { NewTools } from '@/components/data/NewTools';
import { ToolMark } from '@/components/data/ToolMark';
import { WorldCard } from '@/components/worlds/WorldCard';
import { toolWorld } from '@/lib/catalog/helpers';
import { worldSummaries } from '@/lib/catalog/worlds';
import { pickDuels } from '@/lib/catalog/duels';
import { WORLDS } from '@/lib/world-ids';
import { StarterWorkflows } from '@/components/home/StarterWorkflows';
import { activePlacement } from '@/lib/monetization/placements';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  return { title: { absolute: t('home.metaTitle') }, description: t('meta.defaultDescription'), alternates: alternates(locale, (l) => `/${l}`) };
}

/** Prompts under the question box: plain goals for Basis, one technical goal for Advanced. */
const PROMPTS = [
  { key: 'social', task: 'create-social-media-videos', level: 'basis', budget: undefined },
  { key: 'api', task: 'connect-llm-api', level: 'advanced', budget: undefined },
  { key: 'notes', task: 'automatic-meeting-notes', level: 'basis', budget: 'free' },
] as const;

const STARTERS = {
  basis: ['everyday-ai-assistant', 'automatic-meeting-notes', 'create-social-media-videos'],
  advanced: ['connect-llm-api', 'code-with-ai', 'automate-work'],
};

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = (await params) as { locale: Locale };
  const t = getT(locale);
  const catalog = await getCatalog();
  await track({ path: `/${locale}`, pageType: 'home', locale });
  const s = catalog.stats;
  const now = new Date();

  // The radar reads what the agents collected; if the database is unavailable the page still renders.
  let radarData: Radar | null = null;
  try {
    radarData = await radar(getDb(), catalog, now);
  } catch (err) {
    await logError('app', 'home: radar unavailable', err);
  }

  // Three duels (Fair Fights) from different worlds, each tool once.
  const duels = pickDuels(catalog, 3);
  const popular = catalog.tasks.slice(0, 8);
  const worlds = worldSummaries(catalog, t, locale).sort((a, b) => WORLDS.indexOf(a.id) - WORLDS.indexOf(b.id));
  // The dropdowns: every world in plain words, with its tasks.
  const choices: AskChoice[] = WORLDS.map((w) => ({
    world: w,
    label: t(`worlds.verbs.${w}`),
    tasks: catalog.tasks
      .filter((x) => x.categoryId === w)
      .sort((a, b) => a.position - b.position)
      .map((x) => ({ id: x.id, title: taskTextOf(x, locale).title })),
  })).filter((c) => c.tasks.length > 0);
  // Paid placement: labelled and separate from everything the engine recommends.
  const sponsored = await activePlacement('home_sponsored');
  const sponsoredTool = sponsored ? catalog.toolsById.get(sponsored.toolId) : undefined;

  const matchLevel = (l: 'basis' | 'advanced') => (l === 'basis' ? 'beginner' : 'advanced');
  const prompts: AskPrompt[] = PROMPTS.flatMap((p) => {
    const task = catalog.tasksById.get(p.task);
    if (!task) return [];
    const query = t(`hub.prompts.${p.key}.query`);
    return [
      {
        key: p.key,
        label: t(`hub.prompts.${p.key}.label`),
        badge: p.level === 'basis' ? t('hub.badgeBeginner') : t('hub.badgeAdvanced'),
        level: p.level,
        query,
        world: task.categoryId,
        href: href.match(locale, { q: query, task: task.id, lvl: matchLevel(p.level), b: p.budget }),
      },
    ];
  });

  return (
    <>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="container-page">
          <div className="home-hero-copy">
            <h1 id="hero-title" className="display-1">
              {t('home.heroTitle')}
            </h1>
            <p className="home-hero-sub">{t('home.heroSub')}</p>
            <AskBox
              action={href.match(locale)}
              prompts={prompts}
              afterPrompts={
                <p className="mt-5">
                  <Link href={href.start(locale)} className="link-bold">
                    {t('start.homeCta')} →
                  </Link>
                </p>
              }
              choices={choices}
              labels={{
                label: t('match.inputLabel'),
                placeholder: t('hub.placeholder'),
                submit: t('match.submit'),
                hint: t('hub.enterHint'),
                prompts: t('hub.promptsLabel'),
                modes: t('home.chooserModes'),
                modeChoose: t('home.chooserChoose'),
                modeType: t('home.chooserType'),
                stepWorld: t('home.chooserStepWorld'),
                stepTask: t('home.chooserStepTask'),
                stepBudget: t('home.chooserStepBudget'),
                chooseWorld: t('home.chooserPickWorld'),
                chooseTask: t('home.chooserPickTask'),
                budgets: [
                  { value: 'free', label: t('home.chooserBudgetFree') },
                  { value: '25', label: t('home.chooserBudget25') },
                  { value: '100', label: t('home.chooserBudget100') },
                  { value: 'any', label: t('home.chooserBudgetAny') },
                ],
                show: t('home.chooserShow'),
              }}
            />
          </div>
        </div>
        {s.tools > 0 && (
          <div className="container-page">
            <p className="home-proof">
              {t('home.proof', {
                tools: formatNumber(s.tools, locale),
                facts: formatNumber(s.facts + s.plans, locale),
                supported: Math.round(s.supportedShare * 100),
                date: formatDate(s.lastCheckAt, locale),
              })}
            </p>
          </div>
        )}
      </section>

      <section className="home-section" aria-labelledby="worlds-title">
        <div className="container-page">
          <header className="bold-head">
            <h2 id="worlds-title" className="display-2">
              {t('home.worldsTitle')}
            </h2>
            <Link href={href.tools(locale)} className="link-bold">
              {t('explorer.showAll', { count: s.tools })} →
            </Link>
          </header>
          <ul className="world-grid">
            {worlds.map((w) => (
              <li key={w.id}>
                <WorldCard world={w} count={t('home.toolsCount', { count: w.toolCount })} topLabel={t('home.worldTop')} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="container-page home-section home-new empty:hidden">
        <NewTools catalog={catalog} locale={locale} t={t} limit={4} />
      </div>

      {duels.length > 0 && (
        <section className="home-section" aria-labelledby="fights-title">
          <div className="container-page">
            <header className="mb-5">
              <h2 id="fights-title" className="display-3">
                {t('home.fightsTitle')}
              </h2>
              <p className="bold-sub">{t('home.fightsSub')}</p>
            </header>
            <ul className="duel-grid">
              {duels.map(([a, b]) => (
                <li key={`${a.slug}-${b.slug}`}>
                  <Link href={href.fairFight(locale, a.slug, b.slug)} className="duel">
                    <span className="duel-marks" aria-hidden="true">
                      <ToolMark tool={a} world={toolWorld(a, catalog)} size={32} />
                      <span className="duel-vs">vs</span>
                      <ToolMark tool={b} world={toolWorld(b, catalog)} size={32} />
                    </span>
                    <span className="duel-names">
                      {a.name} vs {b.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {radarData && (
        <div className="home-section">
          <div className="container-page">
            <RadarPanel data={radarData} catalog={catalog} t={t} locale={locale} />
          </div>
        </div>
      )}

      <section className="home-section" aria-labelledby="tasks-title">
        <div className="container-page">
          <header className="bold-head">
            <h2 id="tasks-title" className="display-3">
              {t('home.tasksTitle')}
            </h2>
            <Link href={href.tasks(locale)} className="link-bold">
              {t('home.tasksAll')} →
            </Link>
          </header>
          <ul className="task-list">
            {popular.map((task) => {
              const text = taskTextOf(task, locale);
              return (
                <li key={task.id}>
                  <Link href={href.task(locale, taskSlug(task, locale))} className="task-link" data-world={task.categoryId}>
                    <span className="task-dot" aria-hidden="true" />
                    <span className="task-title">{text.title}</span>
                    <span className="task-steps">{t('home.stepsCount', { count: task.steps.length })}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {sponsoredTool && sponsored && (
        <section className="container-page home-section">
          <SponsoredCard tool={sponsoredTool} message={sponsored.message} t={t} locale={locale} />
        </section>
      )}

      {emailEnabled() && (
        <section className="container-page home-section">
          <div className="card grid gap-6 p-6 md:grid-cols-2">
            <div>
              <h2 className="text-xl">{t('home.newsletterTitle')}</h2>
              <p className="mt-2 text-sm text-ink-2">{t('home.newsletterBody')}</p>
            </div>
            <NewsletterForm locale={locale} t={t} />
          </div>
        </section>
      )}

      <div className="container-page home-section">
        <StarterWorkflows catalog={catalog} basis={STARTERS.basis} advanced={STARTERS.advanced} t={t} locale={locale} />
      </div>
    </>
  );
}
