'use client';
/**
 * The view level switch: "Basis" or "Advanced & Developer". A tablist that
 * sets <html data-level>; pages show or hide their level-specific parts with
 * CSS, so nothing re-renders and the static site needs no extra data.
 */
import { useSyncExternalStore, type KeyboardEvent } from 'react';
import { readLevel, subscribeLevel, writeLevel, type ViewLevel } from '@/lib/levels';

const LEVELS: ViewLevel[] = ['basis', 'advanced'];

export function LevelTabs({
  labels,
  compact = false,
  controls,
}: {
  labels: { group: string; basis: string; advanced: string; basisHint?: string; advancedHint?: string };
  compact?: boolean;
  /** id of the region whose content follows the level (for aria-controls). */
  controls?: string;
}) {
  const level = useSyncExternalStore(subscribeLevel, readLevel, () => 'basis' as ViewLevel);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = level === 'basis' ? 'advanced' : 'basis';
    writeLevel(next);
    (e.currentTarget.parentElement?.querySelector(`[data-level-tab="${next}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div role="tablist" aria-label={labels.group} className={compact ? 'level-tabs level-tabs-compact' : 'level-tabs'}>
      {LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          data-level-tab={l}
          aria-selected={level === l}
          aria-controls={controls}
          tabIndex={level === l ? 0 : -1}
          title={l === 'basis' ? labels.basisHint : labels.advancedHint}
          onClick={() => writeLevel(l)}
          onKeyDown={onKey}
          className="level-tab"
        >
          {l === 'basis' ? labels.basis : labels.advanced}
        </button>
      ))}
    </div>
  );
}
