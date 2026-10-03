import Link from 'next/link';
import type { WorldSummary } from '@/lib/catalog/worlds';
import { ToolMark } from '@/components/data/ToolMark';
import { fitStyle } from '@/components/ui/fit';
import { WorldGlyph } from './WorldGlyph';

export type TileSize = 'big' | 'wide' | 'normal';

/**
 * A world as a bold tile in its duotone: the place, the number of tools, the
 * name in display type and a line drawing. A big tile also shows the
 * world's description and its top tools with their marks; a wide tile names
 * the top tools in a line. The whole tile is one link to the category.
 */
export function WorldTile({ world, size, count, topLabel }: { world: WorldSummary; size: TileSize; count: string; topLabel: string }) {
  const names = world.top.map((tool) => tool.name);
  return (
    <Link href={world.href} className="tile marks-light" data-world={world.id}>
      <span className="tile-top">
        <span className="tile-place">{world.place}</span>
        <span className="tile-count">{count}</span>
      </span>
      <span className="tile-body">
        <span className="tile-title" style={fitStyle(world.name)}>
          {world.name}
        </span>
        {size === 'big' && world.description && <span className="tile-text">{world.description}</span>}
        {size === 'big' && world.top.length > 0 && (
          <>
            <span className="tile-chips" aria-hidden="true">
              {world.top.map((tool) => (
                <span key={tool.id} className="tile-chip">
                  <ToolMark tool={tool} world={world.id} size={26} />
                  {tool.name}
                </span>
              ))}
            </span>
            <span className="visually-hidden">
              {topLabel}: {names.join(', ')}
            </span>
          </>
        )}
        {size === 'wide' && names.length > 0 && (
          <span className="tile-top-tools">
            {topLabel}: {names.join(' · ')}
          </span>
        )}
      </span>
      <WorldGlyph world={world.id} className="tile-art" />
    </Link>
  );
}
