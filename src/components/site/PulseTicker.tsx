'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

export interface TickerItem {
  id: string;
  icon: string;
  text: string;
  href: string;
}

const QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function getReducedMotion() {
  return window.matchMedia(QUERY).matches;
}

/** Pausable ticker with real Pulse events. Stops by default under reduced motion. */
export function PulseTicker({
  items,
  labels,
  allHref,
}: {
  items: TickerItem[];
  labels: { region: string; pause: string; play: string; all: string };
  allHref: string;
}) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reducedMotion;
  if (items.length === 0) return null;
  const loop = [...items, ...items];
  return (
    <section aria-label={labels.region} className="border-b border-line bg-card">
      <div className="container-page flex h-9 items-center gap-3 text-sm">
        <Link href={allHref} className="eyebrow shrink-0 no-underline hover:text-ink">
          ▸ Pulse
        </Link>
        <div className="ticker relative min-w-0 flex-1 overflow-hidden" data-paused={paused ? 'true' : 'false'}>
          <ul className="ticker-track" aria-live="off">
            {loop.map((it, i) => (
              <li key={`${it.id}-${i}`} aria-hidden={i >= items.length ? 'true' : undefined}>
                <Link
                  href={it.href}
                  tabIndex={i >= items.length ? -1 : undefined}
                  className="text-ink-2 no-underline hover:text-ink hover:underline"
                >
                  <span aria-hidden="true">{it.icon}</span> {it.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm shrink-0"
          onClick={() => setUserPaused(!paused)}
          aria-pressed={paused}
          aria-label={paused ? labels.play : labels.pause}
        >
          <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        </button>
      </div>
    </section>
  );
}
