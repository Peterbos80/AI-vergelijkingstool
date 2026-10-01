'use client';
/**
 * The stage next to the question box: the wijzer's office until the words
 * belong to a world, then that world's room (docs/strategy/research-2026-10/05).
 * Typing settles for a moment before the room changes, so it never flickers;
 * a hovered or focused prompt previews its world at once. The change is the
 * page's one "moment": the new room rises in while the old one fades out
 * (none of it with prefers-reduced-motion). The caption carries the meaning
 * and is announced politely; the rooms themselves are decorative.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { roomMarkup, isWorld, type SceneId, type WorldId } from '@/components/worlds/rooms';
import { VIEWBOX } from '@/components/worlds/iso';
import { detectWorld, worldIndex, type WorldLexicon } from '@/lib/worlds';
import { askIntent } from './ask-intent';

export interface StageWorld {
  /** "Filmstudio" */
  place: string;
  /** "Video" */
  name: string;
  /** "29 tools" */
  count: string;
  href: string;
}

const SETTLE_MS = 280;
const LEAVE_MS = 700;

function Room({ world, state }: { world: SceneId; state: 'in' | 'out' | 'still' }) {
  return (
    <svg
      className="scene stage-room"
      data-world={world}
      data-state={state}
      viewBox={VIEWBOX}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: roomMarkup(world, `stage-${world}`) }}
    />
  );
}

export function HeroStage({
  lexicon,
  worlds,
  labels,
}: {
  lexicon: WorldLexicon;
  worlds: Partial<Record<WorldId, StageWorld>>;
  labels: { homePlace: string; homeHint: string; enter: string; announce: string };
}) {
  const index = useMemo(() => worldIndex(lexicon), [lexicon]);
  const intent = useSyncExternalStore(askIntent.subscribe, askIntent.get, askIntent.server);
  // The typed text settles before it moves the stage.
  const [settled, setSettled] = useState<WorldId | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const guess = detectWorld(intent.text, index)?.world ?? null;
      // Unclear words keep the current room while there is text; an empty box goes home.
      setSettled((cur) => (guess ?? (intent.text.trim() ? cur : null)));
    }, SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [intent.text, index]);

  const target: SceneId = isWorld(intent.preview) ? intent.preview : (settled ?? 'home');
  const [shown, setShown] = useState<SceneId>('home');
  const [leaving, setLeaving] = useState<SceneId | null>(null);
  // A new target: the shown room starts leaving (state adjusted while rendering, React's pattern for derived state).
  if (target !== shown) {
    setLeaving(shown);
    setShown(target);
  }
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, shown]);

  const info = shown === 'home' ? null : worlds[shown];
  return (
    <div className="stage" data-world={shown}>
      <div className="stage-rooms">
        {leaving && leaving !== shown && <Room key={`out-${leaving}`} world={leaving} state="out" />}
        <Room key={`in-${shown}`} world={shown} state={leaving ? 'in' : 'still'} />
      </div>
      <div className="stage-caption">
        {info ? (
          <a href={info.href} className="stage-link">
            <span className="stage-dot" aria-hidden="true" />
            <span className="stage-place">{info.place}</span>
            <span className="stage-meta">
              {info.name} · {info.count}
            </span>
            <span className="stage-go">{labels.enter} →</span>
          </a>
        ) : (
          <p className="stage-home">
            <span className="stage-dot" aria-hidden="true" />
            <span className="stage-place">{labels.homePlace}</span>
            <span className="stage-meta">{labels.homeHint}</span>
          </p>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {info ? labels.announce.replace('{place}', info.place) : ''}
      </p>
    </div>
  );
}
