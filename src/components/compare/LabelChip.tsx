/**
 * A computed label ("Goedkoopst voor jouw gebruik", "Echt bruikbaar gratis",
 * "Europees bedrijf"): text, never colour only, and always a link to the
 * reason. No hooks, so server and client components both use it.
 */
import type { ComputedLabel } from '@/lib/compare/labels';

export function LabelChip({ label, text, href, title }: { label: ComputedLabel; text: string; href: string; title?: string }) {
  return (
    <a
      href={href}
      title={title}
      data-label={label}
      className="inline-flex items-center rounded-full border border-line bg-paper-2 px-2 py-0.5 font-sans text-xs font-semibold text-ink no-underline hover:border-ink-3"
    >
      {text}
    </a>
  );
}
