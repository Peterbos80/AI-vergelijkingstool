import type { Locale } from '@/i18n/config';
import { formatDate, formatMoney } from '@/i18n/formatters';
import type { PlanHistoryRow } from '@/lib/catalog/detail';
import { nowMs } from '@/lib/time';

/**
 * Step chart of one plan's price over time (SVG, no JS). Rows whose start is
 * unknown (valid_from = valid_to) are drawn as a point "until" that date.
 */
export function PriceHistoryChart({ rows, locale, label }: { rows: PlanHistoryRow[]; locale: Locale; label: string }) {
  const pts = rows
    .filter((r) => r.priceCents !== null && !r.isCustom)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
  if (pts.length < 2) return null;
  const W = 480;
  const H = 120;
  const pad = 28;
  const now = nowMs();
  const t0 = Math.min(...pts.map((p) => p.validFrom.getTime()));
  const t1 = Math.max(now, ...pts.map((p) => (p.validTo ?? new Date(now)).getTime()));
  const max = Math.max(...pts.map((p) => p.priceCents!)) || 1;
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad * 2);
  const y = (c: number) => H - pad - (c / max) * (H - pad * 2);
  const segs = pts.map((p) => ({
    x1: x(p.validFrom.getTime()),
    x2: x((p.validTo ?? new Date(now)).getTime()),
    y: y(p.priceCents!),
    p,
  }));
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full max-w-xl">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--line)" />
        {segs.map((s, i) => (
          <g key={i}>
            <line x1={s.x1} y1={s.y} x2={Math.max(s.x2, s.x1 + 2)} y2={s.y} stroke={s.p.validTo ? 'var(--ink-3)' : 'var(--signal)'} strokeWidth="2.5" />
            {i > 0 && <line x1={s.x1} y1={segs[i - 1]!.y} x2={s.x1} y2={s.y} stroke="var(--ink-3)" strokeDasharray="3 3" />}
            <text x={s.x1} y={s.y - 6} fontSize="10" fill="var(--ink-2)" fontFamily="var(--font-mono)">
              {formatMoney(s.p.priceCents, s.p.currency, locale)}
            </text>
          </g>
        ))}
        <text x={pad} y={H - 8} fontSize="9" fill="var(--ink-3)" fontFamily="var(--font-mono)">
          {formatDate(new Date(t0), locale)}
        </text>
        <text x={W - pad} y={H - 8} fontSize="9" fill="var(--ink-3)" textAnchor="end" fontFamily="var(--font-mono)">
          {formatDate(new Date(t1), locale)}
        </text>
      </svg>
    </figure>
  );
}
