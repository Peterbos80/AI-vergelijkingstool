'use client';
/**
 * The conversational question box on the home page: type in your own words
 * (Enter asks, Shift+Enter adds a line), or pick a prompt. A prompt fills the
 * box, sets the view level and switches the tool matrix below to its task,
 * so "Advanced" prompts show the developer view. Without JavaScript the box
 * is a plain GET form to Match and the prompts are links to their Match.
 */
import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { LevelTabs } from '@/components/level/LevelTabs';
import { MATCH_LEVEL, readLevel, subscribeLevel, writeLevel, type ViewLevel } from '@/lib/levels';

export interface AskPrompt {
  key: string;
  label: string;
  badge: string;
  level: ViewLevel;
  query: string;
  /** Match for this prompt (no-JS fallback and "see the full stack"). */
  href: string;
}

export interface MatrixPanel {
  key: string;
  title: string;
  node: ReactNode;
  /** Link to the full, personalised stack for this panel. */
  matchHref: string;
}

export interface AskLabels {
  label: string;
  placeholder: string;
  submit: string;
  hint: string;
  slogan: string;
  prompts: string;
  levelGroup: string;
  levelBasis: string;
  levelAdvanced: string;
  levelBasisHint: string;
  levelAdvancedHint: string;
  fullStack: string;
  note: string;
}

const noSubscribe = () => () => undefined;

export function AskBox({
  action,
  labels,
  prompts,
  panels,
  defaultPanel,
  afterPrompts,
}: {
  action: string;
  labels: AskLabels;
  prompts: AskPrompt[];
  panels: MatrixPanel[];
  defaultPanel: string;
  /** Shown under the prompts (e.g. the step-by-step finder link). */
  afterPrompts?: ReactNode;
}) {
  const [panel, setPanel] = useState(defaultPanel);
  const [q, setQ] = useState('');
  const level = useSyncExternalStore(subscribeLevel, readLevel, () => 'basis' as ViewLevel);
  // true once hydrated (Enter asks, prompts fill the box); a hook for tests and styling.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const active = panels.find((p) => p.key === panel) ?? panels[0];
  /** The full stack follows the chosen view level. */
  const withLevel = (h: string) => {
    const u = new URL(h, 'https://x.invalid');
    u.searchParams.set('lvl', MATCH_LEVEL[level]);
    return `${u.pathname}${u.search}`;
  };

  const pick = (p: AskPrompt) => (e: MouseEvent<HTMLAnchorElement>) => {
    // New tab, new window: follow the link as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setQ(p.query);
    writeLevel(p.level);
    if (panels.some((x) => x.key === p.key)) setPanel(p.key);
    input.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (q.trim().length >= 3) form.current?.requestSubmit();
    }
  };

  return (
    <div className="ask" data-hydrated={hydrated ? '1' : undefined}>
      <form ref={form} method="get" action={action} role="search" className="ask-box">
        <label htmlFor="match-q" className="visually-hidden">
          {labels.label}
        </label>
        <textarea
          id="match-q"
          ref={input}
          name="q"
          rows={2}
          required
          minLength={3}
          maxLength={300}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          className="ask-input"
          autoComplete="off"
          enterKeyHint="search"
        />
        <input type="hidden" name="lvl" value={MATCH_LEVEL[level]} />
        <div className="ask-bar">
          <p className="ask-slogan">{labels.slogan}</p>
          <p className="ask-hint">{labels.hint}</p>
          <button type="submit" className="ask-submit" aria-label={labels.submit} title={labels.submit}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </form>

      <ul className="ask-prompts" aria-label={labels.prompts}>
        {prompts.map((p) => (
          <li key={p.key}>
            <a href={p.href} onClick={pick(p)} className="prompt-tag" data-prompt-level={p.level} aria-current={panel === p.key ? 'true' : undefined}>
              {p.label} <span className="prompt-badge">{p.badge}</span>
            </a>
          </li>
        ))}
      </ul>
      {afterPrompts}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">{active?.title}</h2>
        <LevelTabs
          controls="tool-matrix"
          labels={{
            group: labels.levelGroup,
            basis: labels.levelBasis,
            advanced: labels.levelAdvanced,
            basisHint: labels.levelBasisHint,
            advancedHint: labels.levelAdvancedHint,
          }}
        />
      </div>
      <div id="tool-matrix" className="mt-3" aria-live="polite">
        {panels.map((p) => (
          <div key={p.key} hidden={p.key !== active?.key} className="matrix-panel">
            {p.node}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="text-ink-3">{labels.note}</p>
        {active && (
          <a href={withLevel(active.matchHref)} className="link-accent font-semibold">
            {labels.fullStack} →
          </a>
        )}
      </div>
    </div>
  );
}
