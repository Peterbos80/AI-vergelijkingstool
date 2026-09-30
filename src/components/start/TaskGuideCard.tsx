import type { Translator } from '@/i18n/format';
import type { TaskGuide } from '@/content/task-guides';

/**
 * The plain-language guide for a task. What it is and what to watch out for
 * show at every level; the three starting steps and the tip are for Basis.
 */
export function TaskGuideCard({ guide, t, headingLevel = 2 }: { guide: TaskGuide; t: Translator; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className="guide-card" aria-label={t('start.guideLabel')}>
      <div>
        <H className="eyebrow">{t('start.guideWhat')}</H>
        <p className="mt-1 text-base text-ink">{guide.what}</p>
      </div>
      <div className="only-basis">
        <H className="eyebrow">{t('start.guideSteps')}</H>
        <ol className="mt-2 space-y-2">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="step-check" aria-hidden="true">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <H className="eyebrow">{t('start.guideWatch')}</H>
        <ul className="mt-2 space-y-1.5 text-sm">
          {guide.watch.map((w, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="text-live">
                !
              </span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="only-basis text-sm">
        <span className="font-semibold">{t('start.guideTip')}:</span> {guide.tip}
      </p>
    </section>
  );
}
