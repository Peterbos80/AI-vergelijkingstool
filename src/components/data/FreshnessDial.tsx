import type { Freshness } from '@/lib/db/schema';
import type { Translator } from '@/i18n/format';

const ANGLE: Record<Freshness, number> = { fresh: 30, aging: 120, stale: 220, unknown: 0 };

/**
 * Mini clock: the hand points at the age of the data; the fresh segment is
 * green. Always paired with a text label for screen readers.
 */
export function FreshnessDial({
  freshness,
  t,
  label,
  size = 16,
}: {
  freshness: Freshness;
  t: Translator;
  label?: string;
  size?: number;
}) {
  const text = label ?? t(`freshness.${freshness}`);
  const angle = ANGLE[freshness];
  const color =
    freshness === 'fresh' ? 'var(--verified)' : freshness === 'aging' ? 'var(--community)' : freshness === 'stale' ? 'var(--danger)' : 'var(--ink-3)';
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = 8 + Math.cos(rad) * 5;
  const y = 8 + Math.sin(rad) * 5;
  return (
    <span className="inline-flex items-center gap-1" title={text}>
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="7" fill="none" stroke="var(--line)" strokeWidth="1.5" />
        <path d="M8 1 A7 7 0 0 1 14.06 4.5" fill="none" stroke="var(--verified)" strokeWidth="1.5" />
        {freshness === 'unknown' ? (
          <circle cx="8" cy="8" r="1.5" fill={color} />
        ) : (
          <line x1="8" y1="8" x2={x.toFixed(2)} y2={y.toFixed(2)} stroke={color} strokeWidth="1.75" strokeLinecap="round" />
        )}
      </svg>
      <span className="visually-hidden">{text}</span>
    </span>
  );
}
