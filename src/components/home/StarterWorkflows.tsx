import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { stepLabel, taskSlug, taskTextOf } from '@/lib/catalog/helpers';
import type { Catalog } from '@/lib/catalog/types';
import { href } from '@/lib/routes';

/**
 * "Get started": free step-by-step plans (the task pages), three for the
 * Basis view and three for Advanced. Optional, and without anything to buy.
 */
export function StarterWorkflows({
  catalog,
  basis,
  advanced,
  t,
  locale,
}: {
  catalog: Catalog;
  basis: string[];
  advanced: string[];
  t: Translator;
  locale: Locale;
}) {
  const card = (id: string, level: 'basis' | 'advanced') => {
    const task = catalog.tasksById.get(id);
    if (!task) return null;
    const text = taskTextOf(task, locale);
    const steps = task.steps.filter((s) => s.required).slice(0, 4);
    return (
      <li key={`${level}-${id}`} className={`starter-card ${level === 'basis' ? 'only-basis' : 'only-advanced'}`}>
        <p className="eyebrow">{level === 'basis' ? t('hub.startBasis') : t('hub.startAdvanced')}</p>
        <h3 className="mt-1 text-lg">{text.title}</h3>
        <p className="mt-1 text-sm text-ink-2">{text.summary}</p>
        <ol className="mt-3 space-y-1.5 text-sm">
          {steps.map((s, i) => (
            <li key={s.key} className="flex gap-2">
              <span className="step-check" aria-hidden="true">
                {i + 1}
              </span>
              <span>{stepLabel(s, locale).label}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={href.task(locale, taskSlug(task, locale))} className="link-accent font-semibold">
            {t('hub.startPlan')} →
          </Link>
          <Link href={href.match(locale, { q: text.title, task: task.id, lvl: level === 'basis' ? 'beginner' : 'advanced' })} className="text-ink-2">
            {t('hub.startStack')}
          </Link>
        </div>
      </li>
    );
  };
  return (
    <section aria-labelledby="start-title">
      <h2 id="start-title" className="display-3">
        {t('hub.startTitle')}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('hub.startSub')}</p>
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {basis.map((id) => card(id, 'basis'))}
        {advanced.map((id) => card(id, 'advanced'))}
      </ul>
    </section>
  );
}
