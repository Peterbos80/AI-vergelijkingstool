import type { ComponentProps } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatMoney } from '@/i18n/formatters';
import { nameOf, stepLabel, taskTextOf } from '@/lib/catalog/helpers';
import type { Catalog } from '@/lib/catalog/types';
import { diagnose, PAINS, type Pain } from '@/lib/engine/doctor';
import { href } from '@/lib/routes';
import { LeadForm } from '@/components/forms/LeadForm';
import { ToolChooser } from '@/components/compare/ToolChooser';
import { chooserData } from '@/components/compare/chooser-data';

type SP = Record<string, string | string[] | undefined>;

/**
 * The Stack Doctor page body, shared by the server page and the static
 * edition's browser rendering. Advice requests need a server, so the lead form
 * only appears when an action is given.
 */
export function DoctorView({
  locale,
  t,
  catalog,
  sp,
  leadAction,
}: {
  locale: Locale;
  t: Translator;
  catalog: Catalog;
  sp: SP;
  leadAction?: ComponentProps<typeof LeadForm>['action'];
}) {
  const slugs = ([] as string[]).concat(sp.t ?? []).flatMap((x) => x.split(',')).filter(Boolean);
  const tools = [...new Set(slugs)].map((s) => catalog.toolsBySlug.get(s)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const pains = ([] as string[]).concat(sp.p ?? []).filter((p): p is Pain => (PAINS as string[]).includes(p));
  const task = typeof sp.task === 'string' ? (catalog.tasksById.get(sp.task) ?? null) : null;
  const submitted = slugs.length > 0 || sp.submitted === '1';
  const d = tools.length ? diagnose(catalog, tools.map((x) => x.id), pains, task) : null;
  const name = (id: string) => catalog.toolsById.get(id)?.name ?? id;
  const money = (list: { cents: number; currency: string }[]) => list.map((m) => formatMoney(m.cents, m.currency, locale)).join(' + ');
  const chooser = chooserData(catalog, t, locale);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl md:text-4xl">{t('doctor.title')}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{t('doctor.intro')}</p>

      <form method="get" action={href.doctor(locale)} className="card mt-6 space-y-5 p-4">
        <input type="hidden" name="submitted" value="1" />
        <fieldset>
          <legend className="eyebrow">{t('doctor.yourTools')}</legend>
          <div className="mt-3">
            <ToolChooser
              name="t"
              max={8}
              min={1}
              suggest={false}
              tools={chooser.tools}
              worlds={chooser.worlds}
              selected={tools.map((x) => x.slug)}
              labels={{
                legend: t('doctor.yourTools'),
                search: t('compare.pickerSearch'),
                searchPlaceholder: t('compare.pickerSearchPlaceholder'),
                worlds: t('compare.pickerWorlds'),
                all: t('compare.pickerAll'),
                chosen: t('compare.pickerChosen'),
                empty: t('doctor.pickerEmpty'),
                remove: t('compare.pickerRemove'),
                suggest: t('compare.pickerSuggest'),
                full: t('doctor.pickerFull'),
                noResults: t('compare.pickerNoResults'),
              }}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend className="eyebrow">{t('doctor.pains')}</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {PAINS.map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input type="checkbox" name="p" value={p} defaultChecked={pains.includes(p)} className="h-4 w-4 accent-[var(--ink)]" />
                {t(`doctor.pain.${p}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="max-w-md">
          <label htmlFor="doc-task" className="label">
            {t('doctor.goal')}
          </label>
          <select id="doc-task" name="task" defaultValue={task?.id ?? ''} className="input">
            <option value="">{t('doctor.goalAny')}</option>
            {catalog.tasks.map((x) => (
              <option key={x.id} value={x.id}>
                {taskTextOf(x, locale).title}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn">
          {t('doctor.submit')}
        </button>
      </form>

      {submitted && !d && <p className="mt-6 text-danger">{t('doctor.needTools')}</p>}

      {d && (
        <section className="mt-10 space-y-8" aria-labelledby="diagnosis" aria-live="polite">
          <h2 id="diagnosis" className="text-2xl">
            {t('doctor.diagnosis')}
          </h2>
          {d.roasts.length > 0 && (
            <ul className="space-y-2">
              {d.roasts.map((r) => (
                <li key={r} className="receipt px-4 py-3 font-sans text-base">
                  {t(`doctor.roast.${r}`)}
                </li>
              ))}
            </ul>
          )}
          <div className="card p-4">
            {d.monthly.length ? (
              <p>
                {t('doctor.monthly')} <strong className="num">{money(d.monthly)}{t('period.month')}</strong>
              </p>
            ) : (
              <p>{t('doctor.monthlyFree')}</p>
            )}
            <p className="mt-1 text-xs text-ink-3">{t('doctor.monthlyNote')}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {d.overlaps.length > 0 && (
              <div>
                <h3 className="eyebrow">{t('doctor.overlapTitle')}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.overlaps.map((o) => (
                    <li key={o.capabilityId}>
                      • {t('doctor.overlapItem', { tools: o.toolIds.map(name).join(', '), capability: nameOf(catalog.capabilitiesById.get(o.capabilityId)!, locale).name.toLowerCase() })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.risks.length > 0 && (
              <div>
                <h3 className="eyebrow">{t('doctor.risksTitle')}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.risks.map((r, i) => (
                    <li key={i}>! {t(`doctor.risk.${r.kind}`, { tool: name(r.toolId) })}</li>
                  ))}
                </ul>
              </div>
            )}
            {d.savings.length > 0 && (
              <div>
                <h3 className="eyebrow">{t('doctor.savingsTitle')}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.savings.map((s) => (
                    <li key={s.toolId}>
                      →{' '}
                      {t('doctor.savingsItem', { alt: name(s.alternativeId), tool: name(s.toolId), saving: formatMoney(s.savingCents, s.currency, locale) })}{' '}
                      <Link href={href.compare(locale, [catalog.toolsById.get(s.toolId)!.slug, catalog.toolsById.get(s.alternativeId)!.slug])}>
                        {t('common.compare')}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.consolidation.length > 0 && (
              <div>
                <h3 className="eyebrow">{t('doctor.consolidationTitle')}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.consolidation.map((c) => (
                    <li key={c.toolId}>→ {t('doctor.consolidationItem', { tool: name(c.toolId), replaces: c.replaces.map(name).join(', ') })}</li>
                  ))}
                </ul>
              </div>
            )}
            {d.gaps.length > 0 && task && (
              <div>
                <h3 className="eyebrow">{t('doctor.gapsTitle')}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.gaps.map((g) => (
                    <li key={g.stepKey}>
                      +{' '}
                      {t('doctor.gapsItem', {
                        step: stepLabel(task.steps.find((s) => s.key === g.stepKey)!, locale).label,
                        tools: g.suggestionIds.map(name).join(', '),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xl">{t('doctor.recipeTitle')}</h3>
            {d.recipe.every((r) => r.action === 'keep') ? (
              <p className="mt-2 text-ink-2">{t('doctor.nothing')}</p>
            ) : null}
            <ol className="receipt mt-3 divide-y divide-line px-4 py-3">
              {d.recipe.map((r, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-2 py-2">
                  <span className="w-24 shrink-0 font-semibold">{t(`doctor.action.${r.action}`)}</span>
                  <Link href={href.tool(locale, catalog.toolsById.get(r.toolId)?.slug ?? '')}>{name(r.toolId)}</Link>
                  {r.withId && <span className="text-ink-2">{t('doctor.withTool', { tool: name(r.withId) })}</span>}
                </li>
              ))}
            </ol>
            {d.estimatedSaving.length > 0 && <p className="mt-2 text-sm text-verified">{t('doctor.saving', { amount: money(d.estimatedSaving) })}</p>}
            {task && (
              <Link href={href.match(locale, { q: taskTextOf(task, locale).title })} className="btn btn-ghost mt-4">
                {t('doctor.saveCta')} →
              </Link>
            )}
          </div>

          {leadAction && (
            <section className="card grid gap-6 p-6 md:grid-cols-2" aria-labelledby="lead">
              <div>
                <h3 id="lead" className="text-lg">
                  {t('doctor.leadTitle')}
                </h3>
                <p className="mt-2 text-sm text-ink-2">{t('doctor.leadBody')}</p>
              </div>
              <LeadForm
                action={leadAction}
                locale={locale}
                labels={{
                  name: t('lead.name'),
                  email: t('lead.email'),
                  company: t('lead.company'),
                  size: t('lead.size'),
                  message: t('lead.message'),
                  consent: t('lead.consent'),
                  submit: t('lead.submit'),
                }}
                sizes={['1', '2-10', '11-50', '51-250', '250+'].map((v) => ({ value: v, label: t(`lead.sizeOptions.${v}`) }))}
              />
            </section>
          )}
        </section>
      )}
    </div>
  );
}
