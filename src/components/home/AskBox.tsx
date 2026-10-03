'use client';
/**
 * The question on the home page, two ways:
 * - "Kies uit een lijst" (the default): three dropdowns — what you want to
 *   do (a world), what exactly (a task of that world), what it may cost —
 *   because typing a question is hard for many people;
 * - "Typ je vraag": type in your own words (Enter asks, Shift+Enter adds a
 *   line), or pick a prompt. A prompt fills the box and sets the view level.
 * The two ways sit in one card; the prompts follow under it. The stage
 * (HeroReceipt) follows the chosen world or the typed words; a hovered prompt
 * previews its world. Without JavaScript both are plain GET forms to Match
 * (the task list then shows every task, grouped by world).
 */
import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
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

export interface AskLabels {
  label: string;
  placeholder: string;
  submit: string;
  hint: string;
  prompts: string;
  modes: string;
  modeChoose: string;
  modeType: string;
  stepWorld: string;
  stepTask: string;
  stepBudget: string;
  chooseWorld: string;
  chooseTask: string;
  budgets: { value: string; label: string }[];
  show: string;
}

/** A world in the dropdowns, with its tasks. */
export interface AskChoice {
  world: string;
  /** "Iets met video" */
  label: string;
  tasks: { id: string; title: string }[];
}

const noSubscribe = () => () => undefined;
const MODE_KEY = 'aitw-ask-mode';

export function AskBox({
  action,
  labels,
  prompts,
  choices,
  afterPrompts,
}: {
  action: string;
  labels: AskLabels;
  prompts: AskPrompt[];
  choices: AskChoice[];
  afterPrompts?: ReactNode;
}) {
  const intent = useSyncExternalStore(askIntent.subscribe, askIntent.get, askIntent.server);
  // The visitor's last way of asking comes back (a per-browser convenience).
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === 'type' || m === 'choose') askIntent.set({ mode: m });
    } catch {
      // Private mode or blocked storage: the default stays.
    }
  }, []);
  const setMode = (mode: 'choose' | 'type') => {
    askIntent.set({ mode, preview: null });
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // The choice lasts for this page only.
    }
  };
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
    askIntent.set({ text: p.query, panel: p.key, preview: null, mode: 'type' });
    writeLevel(p.level);
    // The box appears with this render; focus it right after.
    window.setTimeout(() => input.current?.focus(), 0);
  };
  const preview = (world: string | null) => () => askIntent.set({ preview: world });

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (q.trim().length >= 3) form.current?.requestSubmit();
    }
  };

  const choice = choices.find((c) => c.world === intent.chosen);
  const worldOf = new Map(choices.flatMap((c) => c.tasks.map((x) => [x.id, c.world] as const)));
  const taskTitle = choices.flatMap((c) => c.tasks).find((x) => x.id === intent.task)?.title ?? '';
  const pickWorld = (world: string) => {
    const c = choices.find((x) => x.world === world);
    askIntent.set({ chosen: world || null, task: c?.tasks[0]?.id ?? null });
  };
  const pickTask = (id: string) => askIntent.set({ task: id || null, chosen: worldOf.get(id) ?? intent.chosen });

  return (
    <div className="ask" data-hydrated={hydrated ? '1' : undefined} data-mode={intent.mode}>
      <div className="ask-card">
        {hydrated && (
          <div role="tablist" aria-label={labels.modes} className="ask-modes">
            {(['choose', 'type'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={`ask-tab-${m}`}
                aria-selected={intent.mode === m}
                aria-controls={`ask-panel-${m}`}
                className="ask-mode"
                onClick={() => setMode(m)}
              >
                <Icon name={m === 'choose' ? 'list-plus' : 'pen-line'} size={16} />
                {m === 'choose' ? labels.modeChoose : labels.modeType}
              </button>
            ))}
          </div>
        )}

        <div className="ask-panel ask-panel-choose" id="ask-panel-choose" role={hydrated ? 'tabpanel' : undefined} aria-labelledby={hydrated ? 'ask-tab-choose' : undefined}>
          <form method="get" action={action} className="ask-box ask-choose">
            <div className="choose-row">
              <label htmlFor="ask-world" className="choose-label">
                <span className="choose-n">1</span>
                {labels.stepWorld}
              </label>
              <select id="ask-world" className="input" value={intent.chosen ?? ''} onChange={(e) => pickWorld(e.target.value)}>
                <option value="">{labels.chooseWorld}</option>
                {choices.map((c) => (
                  <option key={c.world} value={c.world}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="choose-row">
              <label htmlFor="ask-task" className="choose-label">
                <span className="choose-n">2</span>
                {labels.stepTask}
              </label>
              <select id="ask-task" name="task" className="input" required value={intent.task ?? ''} onChange={(e) => pickTask(e.target.value)}>
                <option value="">{labels.chooseTask}</option>
                {(choice ? [choice] : choices).map((c) =>
                  choice ? (
                    c.tasks.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))
                  ) : (
                    <optgroup key={c.world} label={c.label}>
                      {c.tasks.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </select>
            </div>
            <div className="choose-row">
              <label htmlFor="ask-budget" className="choose-label">
                <span className="choose-n">3</span>
                {labels.stepBudget}
              </label>
              <select id="ask-budget" name="b" className="input" defaultValue={labels.budgets[0]?.value}>
                {labels.budgets.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            {taskTitle && <input type="hidden" name="q" value={taskTitle} />}
            <input type="hidden" name="lvl" value={MATCH_LEVEL[level]} />
            <div className="choose-go">
              <button type="submit" className="btn btn-go" disabled={hydrated && !intent.task}>
                {labels.show}
                <Icon name="arrow-right" size={18} />
              </button>
            </div>
          </form>
        </div>

        <div className="ask-panel ask-panel-type" id="ask-panel-type" role={hydrated ? 'tabpanel' : undefined} aria-labelledby={hydrated ? 'ask-tab-type' : undefined}>
          <form ref={form} method="get" action={action} role="search" className="ask-box ask-type">
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
        </div>
      </div>

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
