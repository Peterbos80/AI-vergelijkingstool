/**
 * What the visitor is asking on the home page: the question box's state in a
 * tiny external store (no context provider, and it costs nothing until used).
 */
export interface AskIntent {
  /** The text in the question box. */
  text: string;
  /** The prompt that filled the box (null: none). */
  panel: string | null;
  /** The world and the task picked in the dropdowns ("choose" mode). */
  chosen: string | null;
  task: string | null;
  /** How the visitor asks: pick from lists, or type. */
  mode: 'choose' | 'type';
}

const INITIAL: AskIntent = { text: '', panel: null, chosen: null, task: null, mode: 'choose' };
let state = INITIAL;
const listeners = new Set<() => void>();

export const askIntent = {
  get: (): AskIntent => state,
  server: (): AskIntent => INITIAL,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set(patch: Partial<AskIntent>): void {
    const next = { ...state, ...patch };
    if ((Object.keys(next) as (keyof AskIntent)[]).every((k) => next[k] === state[k])) return;
    state = next;
    for (const l of listeners) l();
  },
};
