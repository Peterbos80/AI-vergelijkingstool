import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { formatDayMonth, formatNumber } from '@/i18n/formatters';
import { toolWorld } from '@/lib/catalog/helpers';
import { inQuarantine, newTools } from '@/lib/catalog/new-tools';
import type { Catalog, CatalogTool, DiscoverySignal } from '@/lib/catalog/types';
import { href } from '@/lib/routes';
import { ToolMark } from './ToolMark';

function signalLabel(s: DiscoverySignal, t: Translator, locale: Locale): string {
  if (s.kind === 'announcement') return s.label ? t('newTools.signal.announcement', { maker: s.label }) : t('newTools.signal.announcementOwn');
  return t(`newTools.signal.${s.kind}`, { value: formatNumber(s.value ?? 0, locale) });
}

function quoteOf(tool: CatalogTool): string | null {
  const v = tool.facts.site_description?.value;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * "Just in": new tools found by the tool scout (docs/strategy/12 §4.4), each
 * with its mark, name, a "new" label (and "still being checked" while in
 * quarantine), the site's own description as a quote with its source, and
 * the signals that made the scout pick it: where, how much, when. Renders
 * nothing when there are none. Server-rendered; no script.
 */
export function NewTools({ catalog, locale, t, now = new Date(), limit = 8 }: { catalog: Catalog; locale: Locale; t: Translator; now?: Date; limit?: number }) {
  const all = newTools(catalog, now);
  if (!all.length) return null;
  const shown = all.slice(0, limit);
  return (
    <section aria-labelledby="new-tools-title" className="new-tools" data-testid="new-tools">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="new-tools-title" className="text-xl">
          {t('newTools.title')}
        </h2>
        {all.length > shown.length && (
          <Link href={href.pulse(locale, { type: 'product' })} className="text-sm">
            {t('newTools.more', { count: all.length })} →
          </Link>
        )}
      </div>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">{t('newTools.intro')}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((tool) => {
          const quote = quoteOf(tool);
          const site = new URL(tool.websiteUrl).hostname.replace(/^www\./, '');
          return (
            <li key={tool.id} className="card flex min-w-0 flex-col gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <ToolMark tool={tool} world={toolWorld(tool, catalog)} size={40} />
                <div className="min-w-0">
                  <Link href={href.tool(locale, tool.slug)} className="font-semibold [overflow-wrap:anywhere]">
                    {tool.name}
                  </Link>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full border border-line px-2 py-0.5 font-semibold text-ink">{t('newTools.badge')}</span>
                    {inQuarantine(tool) && <span className="rounded-full border border-line px-2 py-0.5 text-ink-2">{t('newTools.inCheck')}</span>}
                  </p>
                </div>
              </div>
              {quote && (
                <figure className="text-sm">
                  <blockquote cite={tool.websiteUrl} className="text-ink-2 [overflow-wrap:anywhere]">
                    “{quote}”
                  </blockquote>
                  <figcaption className="mt-1 text-xs text-ink-3">{t('newTools.quoteFrom', { site })}</figcaption>
                </figure>
              )}
              {tool.discovery && tool.discovery.signals.length > 0 && (
                <div className="mt-auto">
                  <p className="text-xs text-ink-3">{t('newTools.foundThrough')}</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {tool.discovery.signals.map((s) => (
                      <li key={`${s.kind}:${s.url}`}>
                        <a href={s.url} rel="nofollow noopener noreferrer" className="[overflow-wrap:anywhere]">
                          {signalLabel(s, t, locale)}
                        </a>
                        {s.at && <span className="text-ink-3"> · {formatDayMonth(s.at, locale)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
