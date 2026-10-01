import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { getCatalog, taskSlug, taskTextOf } from '@/lib/catalog';
import { radar, type Radar } from '@/lib/catalog/radar';
import { getDb } from '@/lib/db/client';
import { rankForCapability } from '@/lib/engine/rank';
import { logError } from '@/lib/ops/errors';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { emailEnabled } from '@/lib/env';
import { track } from '@/lib/analytics/track';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import { SponsoredCard } from '@/components/data/SponsoredCard';
import { AskBox, MatrixPanels, type AskChoice, type AskPrompt, type MatrixPanel } from '@/components/home/AskBox';
import { HeroStage, type StageWorld } from '@/components/home/HeroStage';
import { RadarPanel } from '@/components/home/RadarPanel';
import { ToolMark } from '@/components/data/ToolMark';
import { WorldCard } from '@/components/worlds/WorldCard';
import { toolWorld } from '@/lib/catalog/helpers';
import { worldSummaries } from '@/lib/catalog/worlds';
import { pickDuels } from '@/lib/catalog/duels';
import { worldLexicon } from '@/lib/worlds';
import { WORLDS, type WorldId } from '@/lib/world-ids';
import { StarterWorkflows } from '@/components/home/StarterWorkflows';
import { ToolMatrix } from '@/components/home/ToolMatrix';
import { activePlacement } from '@/lib/monetization/placements';
import type { Catalog, CatalogTask, CatalogTool } from '@/lib/catalog/types';

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

/** Tools for a task's required steps, in the engine's ranking order (never sponsoring). */
function taskTools(catalog: Catalog, task: CatalogTask, n: number): CatalogTool[] {
  const lists = task.steps.filter((s) => s.required).flatMap((s) => s.capabilityIds.map((c) => rankForCapability(catalog, c)));
  const out = new Map<string, CatalogTool>();
  for (let i = 0; out.size < n && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.size < n) out.set(l[i]!.id, l[i]!);
  return [...out.values()];
}

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

  // Six duels (Fair Fights) from different worlds, each tool once.
  const duels = pickDuels(catalog, 6);
  const popular = catalog.tasks.slice(0, 8);
  const worlds = worldSummaries(catalog, t, locale);
  // The dropdowns: every world in plain words, with its tasks.
  const choices: AskChoice[] = WORLDS.map((w) => ({
    world: w,
    label: t(`worlds.verbs.${w}`),
    tasks: catalog.tasks
      .filter((x) => x.categoryId === w)
      .sort((a, b) => a.position - b.position)
      .map((x) => ({ id: x.id, title: taskTextOf(x, locale).title })),
  })).filter((c) => c.tasks.length > 0);
  const stageWorlds: Partial<Record<WorldId, StageWorld>> = Object.fromEntries(
    worlds.map((w) => [w.id, { place: w.place, name: w.name, count: t('home.toolsCount', { count: w.toolCount }), href: w.href }]),
  );
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

  const assistants = rankForCapability(catalog, 'chat-assistant').slice(0, 6);
  const panels: MatrixPanel[] = [
    {
      key: 'assistants',
      title: t('hub.matrixAssistants'),
      node: <ToolMatrix tools={assistants} t={t} locale={locale} caption={t('hub.matrixAssistants')} catalog={catalog} />,
      matchHref: href.match(locale, { q: taskTextOf(catalog.tasksById.get('everyday-ai-assistant') ?? catalog.tasks[0]!, locale).title, task: 'everyday-ai-assistant' }),
    },
  ];
  for (const p of PROMPTS) {
    const task = catalog.tasksById.get(p.task);
    const prompt = prompts.find((x) => x.key === p.key);
    if (!task || !prompt) continue;
    let tools: CatalogTool[];
    if (p.key === 'api') {
      // Language models you can reach from code: API first, then the ones you run yourself.
      const models = [...new Map([...rankForCapability(catalog, 'chat-assistant'), ...rankForCapability(catalog, 'local-llm')].map((x) => [x.id, x])).values()];
      const api = (x: CatalogTool) => (x.apiAvailable ?? x.platforms.includes('api')) === true;
      tools = [...models.filter(api), ...models.filter((x) => !api(x))].slice(0, 7);
    } else {
      tools = taskTools(catalog, task, 12);
      if (p.budget === 'free') tools = tools.filter((x) => x.hasFreeTier === true);
      tools = tools.slice(0, 6);
    }
    const title = t('hub.matrixFor', { task: taskTextOf(task, locale).title });
    panels.push({ key: p.key, title, node: <ToolMatrix tools={tools} t={t} locale={locale} caption={title} catalog={catalog} />, matchHref: prompt.href });
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container-page hero-grid">
          <div className="hero-copy">
            <p className="hero-eyebrow">{t('meta.tagline')}</p>
            <h1 id="hero-title" className="hero-title">
              {t('home.heroTitle')}
            </h1>
            <p className="hero-sub">{t('home.heroSub')}</p>
            <div className="mt-7">
              <AskBox
                action={href.match(locale)}
                prompts={prompts}
                afterPrompts={
                  <p className="mt-4 text-sm">
                    <Link href={href.start(locale)} className="link-accent font-semibold">
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
          <div className="hero-visual">
            <HeroStage
              lexicon={worldLexicon(catalog, locale)}
              worlds={stageWorlds}
              labels={{ homePlace: t('worlds.places.home'), homeHint: t('home.stageHint'), enter: t('home.stageEnter'), announce: t('home.stageAnnounce') }}
            />
          </div>
        </div>
        {s.tools > 0 && (
          <div className="container-page">
            <p className="hero-proof mono">
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
          <header className="section-head">
            <p className="eyebrow">{t('home.worldsEyebrow')}</p>
            <h2 id="worlds-title" className="section-title">
              {t('home.worldsTitle')}
            </h2>
            <p className="section-sub">{t('home.worldsSub')}</p>
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

      <section className="home-section home-band" aria-labelledby="matrix-title">
        <div className="container-page">
          <p className="eyebrow mb-2">{t('home.matrixEyebrow')}</p>
          <MatrixPanels
            panels={panels}
            defaultPanel="assistants"
            labels={{
              levelGroup: t('hub.levelGroup'),
              levelBasis: t('hub.levelBasis'),
              levelAdvanced: t('hub.levelAdvanced'),
              levelBasisHint: t('hub.levelBasisHint'),
              levelAdvancedHint: t('hub.levelAdvancedHint'),
              fullStack: t('hub.fullStack'),
              note: t('hub.matrixNote'),
            }}
          />
        </div>
      </section>

      {radarData && (
        <div className="home-section">
          <div className="container-page">
            <RadarPanel data={radarData} catalog={catalog} t={t} locale={locale} />
          </div>
        </div>
      )}

      {duels.length > 0 && (
        <section className="home-section pt-0" aria-labelledby="fights-title">
          <div className="container-page">
            <header className="section-head">
              <p className="eyebrow">{t('home.fightsEyebrow')}</p>
              <h2 id="fights-title" className="section-title">
                {t('home.fightsTitle')}
              </h2>
              <p className="section-sub">{t('home.fightsSub')}</p>
            </header>
            <ul className="versus-grid">
              {duels.map(([a, b]) => (
                <li key={`${a.slug}-${b.slug}`}>
                  <Link href={href.fairFight(locale, a.slug, b.slug)} className="versus">
                    <span className="versus-marks" aria-hidden="true">
                      <ToolMark tool={a} world={toolWorld(a, catalog)} size={44} />
                      <span className="versus-vs">vs</span>
                      <ToolMark tool={b} world={toolWorld(b, catalog)} size={44} />
                    </span>
                    <span className="versus-names">
                      {a.name} <span className="text-ink-3">vs</span> {b.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="home-section pt-0" aria-labelledby="tasks-title">
        <div className="container-page">
          <header className="section-head section-head-row">
            <div>
              <p className="eyebrow">{t('home.tasksEyebrow')}</p>
              <h2 id="tasks-title" className="section-title">
                {t('home.tasksTitle')}
              </h2>
            </div>
            <Link href={href.tasks(locale)} className="link-accent text-sm font-semibold">
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
                    <span className="task-steps mono">{t('home.stepsCount', { count: task.steps.length })}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {sponsoredTool && sponsored && (
        <section className="container-page pb-12">
          <SponsoredCard tool={sponsoredTool} message={sponsored.message} t={t} locale={locale} />
        </section>
      )}

      {emailEnabled() && (
        <section className="container-page pb-12">
          <div className="card grid gap-6 p-6 md:grid-cols-2">
            <div>
              <h2 className="text-xl">{t('home.newsletterTitle')}</h2>
              <p className="mt-2 text-sm text-ink-2">{t('home.newsletterBody')}</p>
            </div>
            <NewsletterForm locale={locale} t={t} />
          </div>
        </section>
      )}

      <div className="container-page pb-16">
        <StarterWorkflows catalog={catalog} basis={STARTERS.basis} advanced={STARTERS.advanced} t={t} locale={locale} />
      </div>
    </>
  );
}
