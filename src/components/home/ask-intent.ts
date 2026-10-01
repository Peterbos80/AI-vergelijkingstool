/**
 * What the visitor is asking on the home page, shared by the question box,
 * the stage that shows the matching world and the matrix of tools. A tiny
 * external store: no context provider, and it costs nothing until used.
 */
export interface AskIntent {
  /** The text in the question box. */
  text: string;
  /** A world shown while a prompt is hovered or focused. */
  preview: string | null;
  /** The matrix panel picked with a prompt (null: the default panel). */
  panel: string | null;
}

const INITIAL: AskIntent = { text: '', preview: null, panel: null };
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
    if (next.text === state.text && next.preview === state.preview && next.panel === state.panel) return;
    state = next;
    for (const l of listeners) l();
  },
};
