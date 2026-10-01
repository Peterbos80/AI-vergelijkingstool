import Link from 'next/link';
import type { WorldSummary } from '@/lib/catalog/worlds';
import { ToolMark } from '@/components/data/ToolMark';
import { WorldScene } from './WorldScene';

/** A world as a card: its room, the place, the category, its size and the tools at the top. */
export function WorldCard({ world, count, topLabel }: { world: WorldSummary; count: string; topLabel: string }) {
  return (
    <Link href={world.href} className="world-card world-live" data-world={world.id}>
      <span className="world-card-stage">
        <WorldScene world={world.id} uid={`card-${world.id}`} />
      </span>
      <span className="world-card-body">
        <span className="world-card-place">{world.place}</span>
        <span className="world-card-name">{world.name}</span>
        <span className="world-card-meta">{count}</span>
        {world.top.length > 0 && (
          <span className="world-card-top">
            <span className="world-card-marks" aria-hidden="true">
              {world.top.map((tool) => (
                <ToolMark key={tool.id} tool={tool} world={world.id} size={24} />
              ))}
            </span>
            <span className="world-card-names">
              <span className="visually-hidden">{topLabel}: </span>
              {world.top.map((tool) => tool.name).join(', ')}
            </span>
          </span>
        )}
      </span>
    </Link>
  );
}
