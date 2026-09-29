import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { formatMoney } from '@/i18n/formatters';
import { getCatalog, nameOf, taskSlug, taskTextOf } from '@/lib/catalog';
import { getDb } from '@/lib/db/client';
import { loadSettings } from '@/lib/settings';
import { runMatch } from '@/lib/engine/match';
import { matchQuery, parseMatchParams } from '@/lib/engine/params';
import { affiliateToolIds } from '@/lib/monetization/affiliate';
import { href } from '@/lib/routes';
import { uuid } from '@/lib/ids';
import { nowDate, nowMs } from '@/lib/time';
import { track } from '@/lib/analytics/track';
import { logMatch } from '@/lib/analytics/match-log';
import { MatchForm } from '@/components/match/MatchForm';
import { StackReceipt, stepName } from '@/components/stack/StackReceipt';
import { StepDetails } from '@/components/stack/StepDetails';
import { DisclosureNote } from '@/components/data/DisclosureNote';
import { ToolRow } from '@/components/data/ToolRow';
import { saveStackAction } from './actions';

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/match'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const p = parseMatchParams(await searchParams);
  const t = getT(locale);
  return {
    title: p.q ? t('match.metaTitle', { goal: p.q.slice(0, 60) }) : t('match.metaTitleEmpty'),
    robots: { index: false, follow: true },
    alternates: { canonical: href.home(locale) },
  };
}

const PLATFORMS = ['web', 'ios', 'android', 'windows', 'macos', 'linux'];

export default async function MatchPage({ params, searchParams }: PageProps<'/[locale]/match'>) {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const p = parseMatchParams(sp);
  const t = getT(locale);
  await track({ path: href.match(locale), pageType: 'match', locale, searchParams: sp });

  if (!p.q && !p.taskOverride) {
    return (
      <div className="container-page py-12">
        <h1 className="text-3xl md:text-4xl">{t('match.heading')}</h1>
        <div className="mt-6 max-w-3xl">
          <MatchForm locale={locale} t={t} />
        </div>
      </div>
    );
  }

  const started = nowMs();
  const catalog = await getCatalog();
  const settings = await loadSettings(getDb());
  const out = await runMatch(
    {
      query: p.q,
      locale,
      explicit: p.explicit,
      approach: p.approach,
      taskOverride: p.taskOverride,
      budget: p.budget,
      skip: p.skip,
      answered: p.answered,
      gatingThreshold: settings.llm.gatingThreshold,
      allowLlm: true,
    },
    catalog,
  );
  const mqId = uuid();
  const result = out.variants?.[p.variant] ?? null;
  await logMatch({
    id: mqId,
    locale,
    intent: out.intent,
    resultToolIds: result ? result.lines.map((l) => l.toolId) : [],
    clarified: p.answered > 0,
    latencyMs: nowMs() - started,
  });
  const affiliates = await affiliateToolIds();
  const task = out.task && out.task.id !== '__adhoc__' ? out.task : null;
  const title = task
    ? taskTextOf(task, locale).title
    : out.intent.capabilityIds.length
      ? t('match.adhocTitle', { capabilities: out.intent.capabilityIds.map((c) => nameOf(catalog.capabilitiesById.get(c)!, locale).name).join(', ') })
      : null;
  const c = out.constraints;
  const hidden = matchQuery(p);
  const detectedBudget =
    c.budgetMonthlyCents !== undefined && !p.budget && !c.freeOnly ? formatMoney(c.budgetMonthlyCents, c.budgetCurrency ?? 'EUR', locale) : null;
  const inStack = result ? result.lines.map((l) => catalog.toolsById.get(l.toolId)!).filter(Boolean) : [];

  return (
    <div className="container-page py-8">
      <MatchForm locale={locale} t={t} defaultValue={p.q} compact />

      {!result ? (
        <section className="mt-10" aria-live="polite">
          <h1 className="text-2xl">{t('match.noMatchTitle')}</h1>
          <p className="mt-2 text-ink-2">{t('match.noMatchBody')}</p>
          {out.suggestions.taskIds.length > 0 && (
            <>
              <h2 className="eyebrow mt-6">{t('match.tryTasks')}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {out.suggestions.taskIds.map((id) => (
                  <li key={id}>
                    <Link href={href.match(locale, { ...matchQuery(p), task: id })} className="chip">
                      {taskTextOf(catalog.tasksById.get(id)!, locale).title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {out.suggestions.toolIds.length > 0 && (
            <>
              <h2 className="eyebrow mt-6">{t('match.tryTools')}</h2>
              <ul className="card mt-2 px-4">
                {out.suggestions.toolIds.map((id) => (
                  <ToolRow key={id} tool={catalog.toolsById.get(id)!} catalog={catalog} t={t} locale={locale} />
                ))}
              </ul>
            </>
          )}
          <p className="mt-6">
            <Link href={href.tasks(locale)}>{t('match.allTasks')} →</Link>
          </p>
        </section>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-8">
            <section aria-live="polite">
              <p className="eyebrow">{t('match.understood')}</p>
              <h1 className="mt-1 text-2xl md:text-3xl">{title}</h1>
              <p className="mt-1 text-xs text-ink-3">
                {t('match.engineNote', { engine: out.intent.engine === 'llm' ? t('match.engineLlm') : t('match.engineLexical') })}
              </p>
              {out.intent.confidence < 0.6 && out.intent.taskCandidates.length > 1 && (
                <div className="mt-3">
                  <p className="text-sm text-ink-2">{t('match.lowConfidence')}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {out.intent.taskCandidates
                      .filter((x) => x.id !== out.intent.taskId)
                      .map((x) => (
                        <li key={x.id}>
                          <Link href={href.match(locale, { ...matchQuery(p), task: x.id })} className="chip">
                            {taskTextOf(catalog.tasksById.get(x.id)!, locale).title}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </section>

            {out.clarification && (
              <section className="card border-ink p-4" aria-labelledby="clarify-q" aria-live="polite">
                <p className="eyebrow">{t('match.clarifyTitle')}</p>
                <form method="get" action={href.match(locale)} className="mt-2">
                  {Object.entries(hidden).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                  <h2 id="clarify-q" className="text-lg">
                    {out.clarification.kind === 'approach'
                      ? t('match.questionApproach', { step: stepName(out.task, out.clarification.stepKey, catalog, locale).toLowerCase() })
                      : out.clarification.kind === 'budget'
                        ? t('match.questionBudget')
                        : t('match.questionTask')}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {out.clarification.kind === 'approach' &&
                      out.clarification.options.map((cap) => (
                        <button key={cap} type="submit" name={`a_${(out.clarification as { stepKey: string }).stepKey}`} value={cap} className="chip">
                          {t.has(`match.approach.${cap}`) ? t(`match.approach.${cap}`) : nameOf(catalog.capabilitiesById.get(cap)!, locale).name}
                        </button>
                      ))}
                    {out.clarification.kind === 'budget' &&
                      out.clarification.options.map((o) => (
                        <button key={o} type="submit" name="b" value={o} className="chip">
                          {o === 'free' ? t('match.budgetFree') : o === '25' ? t('match.budget25') : o === '100' ? t('match.budget100') : t('match.budgetAny')}
                        </button>
                      ))}
                    {out.clarification.kind === 'task' &&
                      out.clarification.options.map((id) => (
                        <button key={id} type="submit" name="task" value={id} className="chip">
                          {taskTextOf(catalog.tasksById.get(id)!, locale).title}
                        </button>
                      ))}
                    <button type="submit" name="skip" value="1" className="chip text-ink-3">
                      {t('match.skip')}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {result.relaxed.length > 0 && (
              <p className="notice notice-warning">
                {t('match.relaxed', { constraints: result.relaxed.map((r) => t(`match.relaxedNames.${r}`)).join(', ') })}
              </p>
            )}

            <nav aria-label={t('match.variants')}>
              <ul className="flex flex-wrap gap-2">
                {(['recommended', 'budget', 'fewest'] as const).map((v) => (
                  <li key={v}>
                    <Link
                      href={href.match(locale, matchQuery(p, { v: v === 'recommended' ? undefined : v }))}
                      aria-current={p.variant === v ? 'true' : undefined}
                      className={`chip ${p.variant === v ? 'chip-active' : ''}`}
                      scroll={false}
                    >
                      {t(`match.variant.${v}`)}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">{t(`match.variantHint.${p.variant}`)}</p>
            </nav>

            {inStack.some((x) => affiliates.has(x.id)) && <DisclosureNote t={t} locale={locale} />}

            <StackReceipt
              result={result}
              task={out.task}
              title={title ?? ''}
              catalog={catalog}
              t={t}
              locale={locale}
              receiptNo={mqId.slice(0, 4).toUpperCase()}
              date={nowDate()}
            />
            <div className="flex flex-wrap items-center gap-3">
              <form action={saveStackAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="params" value={JSON.stringify(hidden)} />
                <button type="submit" className="btn">
                  {t('stack.save')}
                </button>
              </form>
              {inStack.length >= 2 && (
                <Link href={href.compare(locale, inStack.slice(0, 4).map((x) => x.slug))} className="btn btn-ghost">
                  {t('common.compare')}
                </Link>
              )}
              <span className="text-xs text-ink-3">{t('stack.watchHint')}</span>
            </div>

            <section aria-labelledby="details">
              <h2 id="details" className="text-xl">
                {t('match.stepDetails')}
              </h2>
              <div className="mt-4">
                <StepDetails result={result} task={out.task} catalog={catalog} t={t} locale={locale} affiliates={affiliates} mq={mqId} src="match" />
              </div>
              <p className="mt-4 text-xs text-ink-3">{t('match.sourcesNote')}</p>
            </section>
          </div>

          <aside>
            <form method="get" action={href.match(locale)} className="card space-y-3 p-4">
              <h2 className="eyebrow">{t('match.editRequirements')}</h2>
              <input type="hidden" name="q" value={p.q} />
              {Object.entries(p.approach).map(([k, v]) => (
                <input key={k} type="hidden" name={`a_${k}`} value={v} />
              ))}
              {p.taskOverride && <input type="hidden" name="task" value={p.taskOverride} />}
              <input type="hidden" name="skip" value="1" />
              <div>
                <label htmlFor="m-b" className="label">
                  {t('match.budgetLabel')}
                </label>
                <select id="m-b" name="b" defaultValue={p.budget ?? (c.freeOnly ? 'free' : 'any')} className="input">
                  <option value="any">{detectedBudget ? t('match.budgetDetected', { amount: detectedBudget }) : t('match.budgetAny')}</option>
                  <option value="free">{t('match.budgetFree')}</option>
                  <option value="25">{t('match.budget25')}</option>
                  <option value="100">{t('match.budget100')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="m-lvl" className="label">
                  {t('match.levelLabel')}
                </label>
                <select id="m-lvl" name="lvl" defaultValue={c.level ?? ''} className="input">
                  <option value="">{t('match.levelAny')}</option>
                  <option value="beginner">{t('skill.beginner')}</option>
                  <option value="intermediate">{t('skill.intermediate')}</option>
                  <option value="advanced">{t('skill.advanced')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="m-pf" className="label">
                  {t('match.platformLabel')}
                </label>
                <select id="m-pf" name="pf" defaultValue={c.platform ?? ''} className="input">
                  <option value="">{t('match.platformAny')}</option>
                  {PLATFORMS.map((x) => (
                    <option key={x} value={x}>
                      {t(`platforms.${x}`)}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-2 text-sm">
                {(
                  [
                    ['eu', c.eu, 'match.euLabel'],
                    ['nl', c.dutch, 'match.dutchLabel'],
                    ['nw', c.noWatermark, 'match.noWatermarkLabel'],
                    ['os', c.openSource, 'match.openSourceLabel'],
                  ] as const
                ).map(([name, checked, label]) => (
                  <label key={name} className="flex items-center gap-2">
                    <input type="checkbox" name={name} value="1" defaultChecked={Boolean(checked)} className="h-4 w-4 accent-[var(--ink)]" />
                    {t(label)}
                  </label>
                ))}
              </fieldset>
              <button type="submit" className="btn btn-ghost w-full">
                {t('match.apply')}
              </button>
            </form>
            {task && (
              <p className="mt-4 text-sm">
                <Link href={href.task(locale, taskSlug(task, locale))}>{taskTextOf(task, locale).title} →</Link>
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
