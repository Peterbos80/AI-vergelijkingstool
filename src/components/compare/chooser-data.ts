import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/format';
import { nameOf, toolWorld } from '@/lib/catalog/helpers';
import type { Catalog } from '@/lib/catalog/types';
import { isWorld, WORLDS } from '@/lib/world-ids';
import { entryPriceLabel } from '@/components/data/format';
import type { ChooserTool, ChooserWorld } from './ToolChooser';

/** The tools and worlds for a ToolChooser (Compare, Stack Doctor): active tools by name, their world, price from and alternatives. */
export function chooserData(catalog: Catalog, t: Translator, locale: Locale): { tools: ChooserTool[]; worlds: ChooserWorld[] } {
  const tools: ChooserTool[] = catalog.tools
    .filter((x) => x.status !== 'shutdown')
    .map((x) => ({
      slug: x.slug,
      name: x.name,
      world: toolWorld(x, catalog),
      price: entryPriceLabel(x, t, locale),
      logo: x.logo,
      alts: [...x.alternatives]
        .sort((a, b) => Number(b.source === 'editorial') - Number(a.source === 'editorial') || (b.score ?? 0) - (a.score ?? 0))
        .map((a) => catalog.toolsById.get(a.id)?.slug)
        .filter((slug): slug is string => Boolean(slug))
        .slice(0, 6),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const worlds: ChooserWorld[] = WORLDS.flatMap((id) => {
    const cat = catalog.categoriesById.get(id);
    return cat && isWorld(cat.id) && tools.some((x) => x.world === id) ? [{ id, name: nameOf(cat, locale).name }] : [];
  });
  return { tools, worlds };
}
