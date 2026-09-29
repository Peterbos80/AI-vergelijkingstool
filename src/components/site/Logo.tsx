/** Wordmark icon: a dial with a hand ("checked just now"). */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 1.5 A10.5 10.5 0 0 1 21.1 6.75" fill="none" stroke="var(--signal)" strokeWidth="2.5" />
      <line x1="12" y1="12" x2="16.5" y2="7.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
    </svg>
  );
}
