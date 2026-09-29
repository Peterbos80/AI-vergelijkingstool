/**
 * Match URL state (docs/strategy/10 §5): every choice lives in the URL so
 * refresh, back, sharing and no-JS all work.
 *   q            the goal
 *   b            budget: free | 25 | 100 | any
 *   lvl          beginner | intermediate | advanced
 *   eu, nl, nw, os   flags (EU data, Dutch, no watermark, open source)
 *   pf           platform
 *   a_<step>     approach per step (capability id)
 *   task         task chosen in a clarification
 *   skip         stop asking questions
 *   v            variant: recommended | budget | fewest
 */
import type { Variant } from './compose';
import type { Constraints } from './intent';

type SP = Record<string, string | string[] | undefined>;

const PLATFORMS = new Set(['web', 'ios', 'android', 'windows', 'macos', 'linux', 'api', 'chrome_extension']);

function one(sp: SP, k: string): string | undefined {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v)?.slice(0, 500);
}

export interface MatchParams {
  q: string;
  explicit: Constraints;
  approach: Record<string, string>;
  taskOverride?: string;
  budget?: string;
  skip: boolean;
  answered: number;
  variant: Variant;
}

export function parseMatchParams(sp: SP): MatchParams {
  const explicit: Constraints = {};
  const lvl = one(sp, 'lvl');
  if (lvl === 'beginner' || lvl === 'intermediate' || lvl === 'advanced') explicit.level = lvl;
  if (one(sp, 'eu') === '1') explicit.eu = true;
  if (one(sp, 'nl') === '1') explicit.dutch = true;
  if (one(sp, 'nw') === '1') explicit.noWatermark = true;
  if (one(sp, 'os') === '1') explicit.openSource = true;
  const pf = one(sp, 'pf');
  if (pf && PLATFORMS.has(pf)) explicit.platform = pf;
  const approach: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith('a_') && typeof v === 'string' && /^[a-z0-9-]{2,40}$/.test(v)) approach[k.slice(2, 42)] = v;
  }
  const b = one(sp, 'b');
  const budget = b === 'free' || b === '25' || b === '100' || b === 'any' ? b : undefined;
  const task = one(sp, 'task');
  const taskOverride = task && /^[a-z0-9-]{2,60}$/.test(task) ? task : undefined;
  const v = one(sp, 'v');
  return {
    q: (one(sp, 'q') ?? '').trim().slice(0, 300),
    explicit,
    approach,
    taskOverride,
    budget,
    skip: one(sp, 'skip') === '1',
    answered: Object.keys(approach).length + (budget ? 1 : 0) + (taskOverride ? 1 : 0),
    variant: v === 'budget' || v === 'fewest' ? v : 'recommended',
  };
}

/** Serialise params back to a query object (for links and hidden fields). */
export function matchQuery(p: MatchParams, overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const out: Record<string, string> = { q: p.q };
  if (p.budget) out.b = p.budget;
  if (p.explicit.level) out.lvl = p.explicit.level;
  if (p.explicit.eu) out.eu = '1';
  if (p.explicit.dutch) out.nl = '1';
  if (p.explicit.noWatermark) out.nw = '1';
  if (p.explicit.openSource) out.os = '1';
  if (p.explicit.platform) out.pf = p.explicit.platform;
  for (const [k, v] of Object.entries(p.approach)) out[`a_${k}`] = v;
  if (p.taskOverride) out.task = p.taskOverride;
  if (p.skip) out.skip = '1';
  if (p.variant !== 'recommended') out.v = p.variant;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}
