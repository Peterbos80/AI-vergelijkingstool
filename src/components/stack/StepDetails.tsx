import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { toolText } from '@/lib/catalog/helpers';
import type { Catalog, CatalogTask } from '@/lib/catalog/types';
import type { StackResult } from '@/lib/engine/compose';
import { href } from '@/lib/routes';
import { VisitLink } from '@/components/data/VisitLink';
import { ToolMonogram } from '@/components/data/ToolMonogram';
import { entryPriceLabel } from '@/components/data/format';
import { limitationText, reasonText, stepName } from './StackReceipt';

/** Per step: why this tool, what to watch out for, and 2–3 alternatives. */
export function StepDetails({
  result,
  task,
  catalog,
  t,
  locale,
  affiliates,
  mq,
  src,
}: {
  result: StackResult;
  task: CatalogTask | null;
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  affiliates: Set<string>;
  mq?: string;
  src: string;
}) {
  let position = 0;
  return (
    <ol className="space-y-6">
      {result.steps
        .filter((s) => s.toolId && !s.sharedFromStep)
        .map((s) => {
          const tool = catalog.toolsById.get(s.toolId!)!;
          const text = toolText(tool, locale);
          const covered = result.lines.find((l) => l.toolId === tool.id)?.steps ?? [s.key];
          const pos = position++;
          return (
            <li key={s.key} className="card p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ToolMonogram name={tool.name} size={40} />
                  <div>
                    <p className="eyebrow">{covered.map((k) => stepName(task, k, catalog, locale)).join(' · ')}</p>
                    <h3 className="text-lg">
                      <Link href={href.tool(locale, tool.slug)} className="no-underline hover:underline">
                        {tool.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-ink-2">{text?.tagline}</p>
                  </div>
                </div>
                <VisitLink slug={tool.slug} name={tool.name} t={t} locale={locale} src={src} pos={pos} affiliate={affiliates.has(tool.id)} variant="ghost" mq={mq} />
              </div>
              <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <h4 className="eyebrow">{t('match.why')}</h4>
                  <ul className="mt-1.5 space-y-1">
                    {s.reasons.map((r, i) => (
                      <li key={i}>✓ {reasonText(r, t, locale, catalog, task)}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="eyebrow">{t('match.limitations')}</h4>
                  <ul className="mt-1.5 space-y-1 text-ink-2">
                    {s.limitations.map((l, i) => (
                      <li key={`l${i}`}>! {limitationText(l, t)}</li>
                    ))}
                    {(text?.limitations ?? []).slice(0, 2).map((x) => (
                      <li key={x}>! {x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="eyebrow">{t('match.alternatives')}</h4>
                  <ul className="mt-1.5 space-y-1">
                    {s.alternatives.map((a) => {
                      const alt = catalog.toolsById.get(a.toolId);
                      if (!alt) return null;
                      return (
                        <li key={a.toolId}>
                          <Link href={href.tool(locale, alt.slug)}>{alt.name}</Link>{' '}
                          <span className="text-ink-3">
                            · {entryPriceLabel(alt, t, locale)}
                            {a.reason && ` · ${reasonText(a.reason, t, locale, catalog, task)}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {s.alternatives.length > 0 && (
                    <Link
                      href={href.compare(locale, [tool.slug, ...s.alternatives.slice(0, 2).map((a) => catalog.toolsById.get(a.toolId)?.slug ?? '')].filter(Boolean))}
                      className="mt-2 inline-block text-xs"
                    >
                      {t('stack.compareStep')} →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
    </ol>
  );
}
