import Link from 'next/link';
import type { WorldSummary } from '@/lib/catalog/worlds';

/** A world as a quiet card: a dot in its colour, the name, what it is for, its size and the tools at the top. */
export function WorldCard({ world, count, topLabel }: { world: WorldSummary; count: string; topLabel: string }) {
  return (
    <Link href={world.href} className="world-card" data-world={world.id}>
      <span className="world-card-name">{world.name}</span>
      {world.description && <span className="world-card-text">{world.description}</span>}
      <span className="world-card-meta">
        {count}
        {world.top.length > 0 && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="visually-hidden">{topLabel}: </span>
            {world.top.map((tool) => tool.name).join(', ')}
          </>
        )}
      </span>
    </Link>
  );
}
