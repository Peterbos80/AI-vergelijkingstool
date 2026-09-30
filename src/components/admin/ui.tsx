/**
 * Admin UI primitives (server components): cards, stat tiles, badges,
 * tables and empty states, on the site's design tokens.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export type Tone = 'ok' | 'warn' | 'fail' | 'info' | 'neutral' | 'signal';

const TONE: Record<Tone, string> = {
  ok: 'bg-[color-mix(in_srgb,var(--verified)_14%,transparent)] text-verified border-[color-mix(in_srgb,var(--verified)_35%,transparent)]',
  warn: 'bg-warning-bg text-warning-ink border-[color-mix(in_srgb,var(--warning-ink)_30%,transparent)]',
  fail: 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger border-[color-mix(in_srgb,var(--danger)_35%,transparent)]',
  info: 'bg-[color-mix(in_srgb,var(--supported)_12%,transparent)] text-supported border-[color-mix(in_srgb,var(--supported)_30%,transparent)]',
  neutral: 'bg-paper-2 text-ink-2 border-line',
  signal: 'bg-[color-mix(in_srgb,var(--signal)_12%,transparent)] text-signal-ink border-[color-mix(in_srgb,var(--signal)_35%,transparent)]',
};

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[tone]}`}>
      {children}
    </span>
  );
}

export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'ok':
    case 'success':
    case 'verified':
    case 'approved':
    case 'active':
    case 'up':
    case 'auto_resolved':
      return 'ok';
    case 'warn':
    case 'partial':
    case 'pending':
    case 'queued':
    case 'aging':
    case 'defaulted':
      return 'warn';
    case 'fail':
    case 'failed':
    case 'down':
    case 'stale':
    case 'rejected':
      return 'fail';
    case 'running':
    case 'info':
      return 'info';
    default:
      return 'neutral';
  }
}

export function severityTone(s: string): Tone {
  return s === 'p1' ? 'fail' : s === 'p2' ? 'signal' : 'neutral';
}

export function Card({ title, action, children, className = '', id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`card p-4 md:p-5 ${className}`} aria-labelledby={id && title ? `${id}-title` : undefined}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title && (
            <h2 id={id ? `${id}-title` : undefined} className="text-base font-bold">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, foot, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; foot?: ReactNode; tone?: Tone }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <div className="eyebrow">{label}</div>
      <div className={`tabular text-2xl font-bold ${tone === 'fail' ? 'text-danger' : tone === 'warn' ? 'text-warning-ink' : ''}`}>{value}</div>
      {sub && <div className="text-sm text-ink-2">{sub}</div>}
      {foot && <div className="mt-auto pt-2 text-xs text-ink-3">{foot}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[var(--radius-sm)] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}

export function PageHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Flash({ message, tone = 'ok' }: { message: string | null; tone?: Tone }) {
  if (!message) return null;
  return (
    <div role="status" className={`mb-4 rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${TONE[tone]}`}>
      {message}
    </div>
  );
}

export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <table className="w-full min-w-[36rem] text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line text-left">
            {head.map((h, i) => (
              <th key={i} scope="col" className="eyebrow py-2 pr-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  );
}

export function TextLink({ href, children, external }: { href: string; children: ReactNode; external?: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line hover:decoration-ink">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="underline decoration-line hover:decoration-ink">
      {children}
    </Link>
  );
}

/** Horizontal bar for a share (0–1), labelled for assistive tech. */
export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
      <div className="h-full rounded-full bg-ink" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
