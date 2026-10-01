import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { toolText } from '@/lib/catalog/helpers';
import type { CatalogTool } from '@/lib/catalog/types';
import { href } from '@/lib/routes';
import { entryPriceLabel } from '@/components/data/format';
import { ToolMonogram } from '@/components/data/ToolMonogram';
import { Icon } from '@/components/ui/Icon';

const CONSUMER_PLATFORMS = ['web', 'ios', 'android', 'windows', 'macos'];
const DEVELOPER_PLATFORMS = ['api', 'cli', 'vscode', 'jetbrains', 'chrome_extension', 'linux', 'self_hosted'];

/** A value we have not recorded with a source is left out, never guessed (a dash, no "unknown"). */
function Missing({ t }: { t: Translator }) {
  return (
    <span className="text-ink-3" aria-label={t('hub.noData')} title={t('hub.noData')}>
      –
    </span>
  );
}

function Yes({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-ok">
      <Icon name="check" size={16} />
      {children}
    </span>
  );
}

/**
 * Tools side by side in two views: consumer facts for "Basis", technical
 * facts for "Advanced & Developer" (.only-basis / .only-advanced columns, so
 * the switch is instant and works on the static site). Order comes from the
 * engine's capability ranking, which never looks at sponsoring or affiliates.
 */
export function ToolMatrix({ tools, t, locale, caption }: { tools: CatalogTool[]; t: Translator; locale: Locale; caption: string }) {
  return (
    <div className="table-scroll matrix">
      <table className="table-data">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('hub.col.tool')}</th>
            <th scope="col" className="only-basis">
              {t('hub.col.from')}
            </th>
            <th scope="col" className="only-basis">
              {t('hub.col.bestFor')}
            </th>
            <th scope="col" className="only-basis">
              {t('hub.col.ease')}
            </th>
            <th scope="col" className="only-basis">
              {t('hub.col.worksOn')}
            </th>
            <th scope="col" className="only-advanced">
              {t('hub.col.api')}
            </th>
            <th scope="col" className="only-advanced">
              {t('hub.col.integrations')}
            </th>
            <th scope="col" className="only-advanced">
              {t('hub.col.selfHost')}
            </th>
            <th scope="col" className="only-advanced">
              {t('hub.col.pricingModel')}
            </th>
            <th scope="col" className="only-advanced">
              {t('hub.col.level')}
            </th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => {
            const consumer = tool.platforms.filter((p) => CONSUMER_PLATFORMS.includes(p));
            const developer = tool.platforms.filter((p) => DEVELOPER_PLATFORMS.includes(p));
            const api = tool.apiAvailable ?? (tool.platforms.includes('api') ? true : null);
            const text = toolText(tool, locale);
            return (
              <tr key={tool.id}>
                <th scope="row" className="font-normal normal-case tracking-normal">
                  <Link href={href.tool(locale, tool.slug)} className="flex items-center gap-2.5 no-underline">
                    <ToolMonogram name={tool.name} size={28} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{tool.name}</span>
                      <span className="block max-w-[16rem] truncate text-xs text-ink-3">{text?.tagline}</span>
                    </span>
                  </Link>
                </th>
                <td className="only-basis whitespace-nowrap">
                  {tool.hasFreeTier ? (
                    <>
                      <span className="font-medium text-ok">{t('common.free')}</span>
                      {tool.entryPriceCents !== null && (
                        <span className="num block text-xs text-ink-3">{t('hub.paidFrom', { price: entryPriceLabel(tool, t, locale) })}</span>
                      )}
                    </>
                  ) : tool.entryPriceCents !== null ? (
                    <span className="num">{t('hub.from', { price: entryPriceLabel(tool, t, locale) })}</span>
                  ) : (
                    <Missing t={t} />
                  )}
                </td>
                <td className="only-basis min-w-[10rem] text-ink-2">{text?.bestFor?.[0] ?? <Missing t={t} />}</td>
                <td className="only-basis whitespace-nowrap">{t(`hub.ease.${tool.skillLevel}`)}</td>
                <td className="only-basis">{consumer.length ? consumer.map((p) => t(`platforms.${p}`)).join(', ') : <Missing t={t} />}</td>
                <td className="only-advanced">{api === null ? <Missing t={t} /> : api ? <Yes>{t('common.yes')}</Yes> : t('common.no')}</td>
                <td className="only-advanced">{developer.length ? developer.map((p) => t(`platforms.${p}`)).join(', ') : <Missing t={t} />}</td>
                <td className="only-advanced whitespace-nowrap">
                  {tool.openSource ? (
                    <Yes>{t('hub.openSource')}</Yes>
                  ) : tool.selfHostable ? (
                    <Yes>{t('common.yes')}</Yes>
                  ) : tool.selfHostable === false ? (
                    t('common.no')
                  ) : (
                    <Missing t={t} />
                  )}
                </td>
                <td className="only-advanced whitespace-nowrap">{tool.pricingModel === 'unknown' ? <Missing t={t} /> : t(`pricingModel.${tool.pricingModel}`)}</td>
                <td className="only-advanced whitespace-nowrap">{t(`skill.${tool.skillLevel}`)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
