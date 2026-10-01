'use client';
/**
 * Pick 2 to 4 tools to compare, the visual way: filter by world or search by
 * name, tap tools (logo, name, price from), and get the alternatives of the
 * last one you picked (our alternatives data, not usage statistics). It is a GET form of checkboxes, so without JavaScript every
 * tool is listed by world and the form still works; with JavaScript the
 * search, the world filter, the limit of four and the suggestions come in.
 */
import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { ToolMark } from '@/components/data/ToolMark';
import { Icon } from '@/components/ui/Icon';
import type { ToolLogo } from '@/generated/logos';
import type { SceneId, WorldId } from '@/lib/world-ids';

export interface ChooserTool {
  slug: string;
  name: string;
  world: SceneId;
  /** "US$ 20/mnd", "Gratis", … */
  price: string;
  logo: ToolLogo | null;
  /** Its alternatives (editorial first, then by score), as slugs. */
  alts: string[];
}

export interface ChooserWorld {
  id: WorldId;
  name: string;
}

export interface ChooserLabels {
  legend: string;
  search: string;
  searchPlaceholder: string;
  worlds: string;
  all: string;
  chosen: string;
  empty: string;
  remove: string;
  suggest: string;
  full: string;
  noResults: string;
  /** The button per number chosen (0–max), for a chooser with its own form. */
  submit?: string[];
  /** The button without JavaScript. */
  submitPlain?: string;
}

const noSubscribe = () => () => undefined;
const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function ToolChooser({
  action,
  name = 'tools',
  max = 4,
  min = 2,
  suggest = true,
  tools,
  worlds,
  selected,
  labels,
}: {
  /** Compare: the chooser is its own GET form to this URL. Without it, the chooser lives inside the caller's form. */
  action?: string;
  /** The checkboxes' name (Compare "tools", Stack Doctor "t"). */
  name?: string;
  max?: number;
  min?: number;
  /** Offer the alternatives of the last pick. */
  suggest?: boolean;
  tools: ChooserTool[];
  worlds: ChooserWorld[];
  selected: string[];
  labels: ChooserLabels;
}) {
  const MAX = max;
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [chosen, setChosen] = useState<string[]>(selected.slice(0, MAX));
  const [world, setWorld] = useState<WorldId | null>(null);
  const [q, setQ] = useState('');
  const bySlug = useMemo(() => new Map(tools.map((t) => [t.slug, t])), [tools]);
  const full = chosen.length >= MAX;

  const query = fold(q.trim());
  const visible = tools.filter((t) => (!world || t.world === world) && (!query || fold(t.name).includes(query)));
  const groups = [...worlds.map((w) => ({ id: w.id as SceneId, name: w.name })), { id: 'home' as SceneId, name: '' }]
    .map((w) => ({ ...w, tools: visible.filter((t) => t.world === w.id) }))
    .filter((g) => g.tools.length > 0);

  const toggle = (slug: string) => setChosen((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length >= MAX ? cur : [...cur, slug]));
  const last = chosen.length ? bySlug.get(chosen[chosen.length - 1]!) : undefined;
  const suggestions = suggest && last && !full ? last.alts.filter((s) => !chosen.includes(s) && bySlug.has(s)).slice(0, 3) : [];

  // With JavaScript the URL gets the short form (?tools=a,b); a full page load, also on the static site.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!hydrated || !action) return;
    e.preventDefault();
    if (chosen.length < min) return;
    // A full page load on purpose: the static site computes query pages from the URL on load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${action}?tools=${chosen.map(encodeURIComponent).join(',')}`);
  };

  const body = (
    <>
      {hydrated && (
        <div className="chooser-filters">
          <div className="chooser-search">
            <Icon name="search" size={18} className="chooser-search-icon" />
            <label htmlFor="chooser-q" className="visually-hidden">
              {labels.search}
            </label>
            <input
              id="chooser-q"
              type="search"
              className="input"
              placeholder={labels.searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          {/* Small screens: one native dropdown; larger screens: the worlds as buttons. */}
          <div className="chooser-world-select">
            <label htmlFor="chooser-world" className="label">
              {labels.worlds}
            </label>
            <select id="chooser-world" className="input" value={world ?? ''} onChange={(e) => setWorld((e.target.value || null) as WorldId | null)}>
              <option value="">{labels.all}</option>
              {worlds.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div role="group" aria-label={labels.worlds} className="chooser-worlds">
            <button type="button" className="chip" aria-pressed={world === null} onClick={() => setWorld(null)}>
              {labels.all}
            </button>
            {worlds.map((w) => (
              <button key={w.id} type="button" className="chip" data-world={w.id} aria-pressed={world === w.id} onClick={() => setWorld(world === w.id ? null : w.id)}>
                <span className="prompt-dot" aria-hidden="true" />
                {w.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <fieldset className="chooser-list">
        <legend className="visually-hidden">{labels.legend}</legend>
        {groups.length === 0 && <p className="text-ink-2">{labels.noResults}</p>}
        {groups.map((g) => (
          <section key={g.id} className="chooser-group" data-world={g.id === 'home' ? undefined : g.id} aria-label={g.name || undefined}>
            {g.name && !world && (
              <h3 className="chooser-group-title">
                <span className="prompt-dot" aria-hidden="true" />
                {g.name}
              </h3>
            )}
            <ul className="chooser-grid">
              {g.tools.map((tool) => {
                const on = chosen.includes(tool.slug);
                return (
                  <li key={tool.slug}>
                    <label className="pick" data-world={tool.world === 'home' ? undefined : tool.world}>
                      <input
                        type="checkbox"
                        name={name}
                        value={tool.slug}
                        className="pick-input"
                        checked={on}
                        disabled={hydrated && !on && full}
                        onChange={() => toggle(tool.slug)}
                      />
                      <ToolMark tool={tool} world={tool.world} size={32} />
                      <span className="pick-text">
                        <span className="pick-name">{tool.name}</span>
                        <span className="pick-price">{tool.price}</span>
                      </span>
                      <span className="pick-check" aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </fieldset>

      <div className="chooser-tray">
        {hydrated && (
          <div className="chooser-tray-main">
            <p className="chooser-count">
              {labels.chosen} <span className="mono">{chosen.length}/{MAX}</span>
            </p>
            {chosen.length === 0 ? (
              <p className="chooser-empty">{labels.empty}</p>
            ) : (
              <ul className="chooser-chosen">
                {chosen.map((slug) => {
                  const tool = bySlug.get(slug);
                  if (!tool) return null;
                  return (
                    <li key={slug} className="chosen-chip">
                      <ToolMark tool={tool} world={tool.world} size={20} />
                      {tool.name}
                      <button type="button" className="chosen-remove" aria-label={labels.remove.replace('{name}', tool.name)} onClick={() => toggle(slug)}>
                        <Icon name="x" size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {suggestions.length > 0 && last && (
              <p className="chooser-suggest">
                <span className="text-ink-3">{labels.suggest.replace('{name}', last.name)}</span>
                {suggestions.map((s) => (
                  <button key={s} type="button" className="chip chip-add" onClick={() => toggle(s)}>
                    <Icon name="plus" size={14} />
                    {bySlug.get(s)!.name}
                  </button>
                ))}
              </p>
            )}
            {full && <p className="chooser-full">{labels.full}</p>}
          </div>
        )}
        {action && labels.submit && (
          <button type="submit" className="btn" disabled={hydrated && chosen.length < min}>
            {hydrated ? labels.submit[Math.min(chosen.length, labels.submit.length - 1)] : labels.submitPlain}
          </button>
        )}
      </div>
    </>
  );

  return action ? (
    <form method="get" action={action} className="chooser" onSubmit={onSubmit} data-hydrated={hydrated ? '1' : undefined}>
      {body}
    </form>
  ) : (
    <div className="chooser chooser-embedded" data-hydrated={hydrated ? '1' : undefined}>
      {body}
    </div>
  );
}
