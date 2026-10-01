'use client';
/**
 * The conversational question box on the home page: type in your own words
 * (Enter asks, Shift+Enter adds a line), or pick a prompt. A prompt fills the
 * box, sets the view level and switches the tool matrix to its task; while a
 * prompt is hovered or focused the stage previews its world. Without
 * JavaScript the box is a plain GET form to Match and the prompts are links
 * to their Match.
 */
import { useRef, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { LevelTabs } from '@/components/level/LevelTabs';
import { Icon } from '@/components/ui/Icon';
import { MATCH_LEVEL, readLevel, subscribeLevel, writeLevel, type ViewLevel } from '@/lib/levels';
import { askIntent } from './ask-intent';

export interface AskPrompt {
  key: string;
  label: string;
  badge: string;
  level: ViewLevel;
  query: string;
  /** The world of the prompt's task (the stage previews it). */
  world: string | null;
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
  prompts: string;
}

const noSubscribe = () => () => undefined;

export function AskBox({ action, labels, prompts, afterPrompts }: { action: string; labels: AskLabels; prompts: AskPrompt[]; afterPrompts?: ReactNode }) {
  const intent = useSyncExternalStore(askIntent.subscribe, askIntent.get, askIntent.server);
  const level = useSyncExternalStore(subscribeLevel, readLevel, () => 'basis' as ViewLevel);
  // true once hydrated (Enter asks, prompts fill the box); a hook for tests and styling.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const q = intent.text;

  const pick = (p: AskPrompt) => (e: MouseEvent<HTMLAnchorElement>) => {
    // New tab, new window: follow the link as usual.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    askIntent.set({ text: p.query, panel: p.key, preview: null });
    writeLevel(p.level);
    input.current?.focus();
  };
  const preview = (world: string | null) => () => askIntent.set({ preview: world });

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
          onChange={(e) => askIntent.set({ text: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          className="ask-input"
          autoComplete="off"
          enterKeyHint="search"
        />
        <input type="hidden" name="lvl" value={MATCH_LEVEL[level]} />
        <div className="ask-bar">
          <p className="ask-hint">{labels.hint}</p>
          <button type="submit" className="ask-submit" aria-label={labels.submit} title={labels.submit}>
            <Icon name="arrow-right" size={20} />
          </button>
        </div>
      </form>

      <ul className="ask-prompts" aria-label={labels.prompts}>
        {prompts.map((p) => (
          <li key={p.key}>
            <a
              href={p.href}
              onClick={pick(p)}
              onPointerEnter={preview(p.world)}
              onPointerLeave={preview(null)}
              onFocus={preview(p.world)}
              onBlur={preview(null)}
              className="prompt-tag"
              data-world={p.world ?? undefined}
              data-prompt-level={p.level}
              aria-current={intent.panel === p.key ? 'true' : undefined}
            >
              <span className="prompt-dot" aria-hidden="true" />
              {p.label} <span className="prompt-badge">{p.badge}</span>
            </a>
          </li>
        ))}
      </ul>
      {afterPrompts}
    </div>
  );
}

/** The tool matrix under the question box; a prompt picks its panel. */
export function MatrixPanels({
  panels,
  defaultPanel,
  labels,
}: {
  panels: MatrixPanel[];
  defaultPanel: string;
  labels: { levelGroup: string; levelBasis: string; levelAdvanced: string; levelBasisHint: string; levelAdvancedHint: string; fullStack: string; note: string };
}) {
  const intent = useSyncExternalStore(askIntent.subscribe, askIntent.get, askIntent.server);
  const level = useSyncExternalStore(subscribeLevel, readLevel, () => 'basis' as ViewLevel);
  const active = panels.find((p) => p.key === (intent.panel ?? defaultPanel)) ?? panels[0];
  /** The full stack follows the chosen view level. */
  const withLevel = (h: string) => {
    const u = new URL(h, 'https://x.invalid');
    u.searchParams.set('lvl', MATCH_LEVEL[level]);
    return `${u.pathname}${u.search}`;
  };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="matrix-title" className="text-xl">
          {active?.title}
        </h2>
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
      <div id="tool-matrix" className="mt-4" aria-live="polite">
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
    </>
  );
}
