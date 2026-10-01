/**
 * Task page section "Wat kost het voor mij?": the usage calculator for the
 * meters that belong to this task (lib/compare/usage → METERS[].tasks). The
 * data is computed here at render time and passed to the client calculator.
 */
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { pickMessages } from '@/i18n/server';
import type { Catalog, CatalogTask } from '@/lib/catalog/types';
import { buildMeter, metersForTask } from '@/lib/compare/usage';
import { href } from '@/lib/routes';
import { CostCalculator } from './CostCalculator';

export function TaskCosts({ task, catalog, t, locale }: { task: CatalogTask; catalog: Catalog; t: Translator; locale: Locale }) {
  const defs = metersForTask(task.id);
  if (!defs.length) return null;
  const messages = pickMessages(locale, ['costs', 'status']);
  return (
    <section className="mt-12" aria-labelledby="task-costs">
      <h2 id="task-costs" className="text-xl">
        {t('costs.taskHeading')}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('costs.taskIntro')}</p>
      {t.has(`costs.taskNotes.${task.id}`) && <p className="mt-1 max-w-2xl text-sm text-ink-2">{t(`costs.taskNotes.${task.id}`)}</p>}
      {defs.map((def) => (
        <div key={def.id} className="mt-4 max-w-3xl">
          {defs.length > 1 && <h3 className="mb-2 font-semibold">{t(`costs.meters.${def.id}.title`)}</h3>}
          <CostCalculator
            meter={buildMeter(catalog, def)}
            locale={locale}
            messages={messages}
            question={t(`costs.meters.${def.id}.question`)}
            footer={
              <p className="text-sm">
                <Link href={`${href.costs(locale)}#${def.id}`}>{t('costs.hubLink')} →</Link>
              </p>
            }
          />
        </div>
      ))}
    </section>
  );
}
