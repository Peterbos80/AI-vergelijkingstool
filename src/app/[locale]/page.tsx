import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatDate, formatNumber } from '@/i18n/formatters';
import { getCatalog, taskSlug, taskTextOf } from '@/lib/catalog';
import { radar, type Radar } from '@/lib/catalog/radar';
import { getDb } from '@/lib/db/client';
import { fairFightGate } from '@/lib/engine/compare';
import { rankForCapability } from '@/lib/engine/rank';
import { agentStatus, type AgentStatus } from '@/lib/ops/agent-status';
import { logError } from '@/lib/ops/errors';
import { href } from '@/lib/routes';
import { alternates } from '@/lib/seo';
import { emailEnabled } from '@/lib/env';
import { track } from '@/lib/analytics/track';
import { NewsletterForm } from '@/components/forms/NewsletterForm';
import { SponsoredCard } from '@/components/data/SponsoredCard';
import { AskBox, type AskPrompt, type MatrixPanel } from '@/components/home/AskBox';
import { AgentStatusPanel } from '@/components/home/AgentStatusPanel';
import { RadarPanel } from '@/components/home/RadarPanel';
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

  // Live panels read the agents' own logs; if the database is unavailable the page still renders.
  let statuses: AgentStatus[] | null = null;
  let radarData: Radar | null = null;
  try {
    [statuses, radarData] = await Promise.all([agentStatus(getDb(), now), radar(getDb(), catalog, now)]);
  } catch (err) {
    await logError('app', 'home: agent status or radar unavailable', err);
  }

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
        href: href.match(locale, { q: query, task: task.id, lvl: matchLevel(p.level), b: p.budget }),
      },
    ];
  });

  const assistants = rankForCapability(catalog, 'chat-assistant').slice(0, 6);
  const panels: MatrixPanel[] = [
    {
      key: 'assistants',
      title: t('hub.matrixAssistants'),
      node: <ToolMatrix tools={assistants} t={t} locale={locale} caption={t('hub.matrixAssistants')} />,
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
    panels.push({ key: p.key, title, node: <ToolMatrix tools={tools} t={t} locale={locale} caption={title} />, matchHref: prompt.href });
  }

  return (
    <>
      <section className="hero border-b border-line">
        <div className="container-page py-12 md:py-16">
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02]">{t('home.heroTitle')}</h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-2">{t('home.heroSub')}</p>
          <div className="mt-8 max-w-4xl">
            <AskBox
              action={href.match(locale)}
              prompts={prompts}
              panels={panels}
              defaultPanel="assistants"
              labels={{
                label: t('match.inputLabel'),
                placeholder: t('hub.placeholder'),
                submit: t('match.submit'),
                hint: t('hub.enterHint'),
                slogan: t('meta.tagline'),
                prompts: t('hub.promptsLabel'),
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

      {statuses && (
        <div className="container-page py-12">
          <AgentStatusPanel statuses={statuses} asOf={now} t={t} locale={locale} />
        </div>
      )}

      {radarData && (
        <div className="container-page pb-12">
          <RadarPanel data={radarData} catalog={catalog} t={t} locale={locale} />
        </div>
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

      {sponsoredTool && sponsored && (
        <section className="container-page pb-12">
          <SponsoredCard tool={sponsoredTool} message={sponsored.message} t={t} locale={locale} />
        </section>
      )}

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

      <div className="container-page py-12">
        <StarterWorkflows catalog={catalog} basis={STARTERS.basis} advanced={STARTERS.advanced} t={t} locale={locale} />
      </div>
    </>
  );
}
