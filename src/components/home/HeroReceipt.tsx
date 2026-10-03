'use client';
/**
 * The stage next to the question (docs/strategy/research-2026-10/05, round 5):
 * a block in the colour of the world the visitor asks about, with the receipt
 * of that world's top tool: its entry plan and price, the status, the date we
 * saw it and the source. Before the words belong to a world it shows the most
 * recently checked price. A hovered or focused prompt moves the stage at
 * once, then the world picked in the lists, then the typed words once they
 * settle (so it never flickers). The new receipt slides in, the colour fades
 * over (neither with prefers-reduced-motion). The caption carries the
 * meaning and is announced politely; shapes and colour are decorative.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ToolMark } from '@/components/data/ToolMark';
import type { CatalogTool } from '@/lib/catalog/types';
import type { FactStatus } from '@/lib/db/schema';
import { detectWorld, worldIndex, type WorldLexicon } from '@/lib/worlds';
import { isWorld, type SceneId, type WorldId } from '@/lib/world-ids';
import { askIntent } from './ask-intent';

/** One receipt, formatted on the server. */
export interface StageReceipt {
  name: string;
  logo: CatalogTool['logo'];
  href: string;
  plan: string | null;
  price: string;
  status: FactStatus | null;
  statusLabel: string | null;
  /** The date the price was seen: shown, and as ISO for <time>. */
  date: string | null;
  dateIso: string | null;
  /** "elevenlabs.io/pricing" */
  source: string | null;
}

export interface StageWorld {
  /** "Filmstudio" */
  place: string;
  /** "Video" */
  name: string;
  /** "29 tools" */
  count: string;
  href: string;
  receipt: StageReceipt | null;
}

export interface StageLabels {
  receipt: string;
  plan: string;
  price: string;
  status: string;
  seen: string;
  source: string;
  note: string;
  caption: string;
  enter: string;
  announce: string;
}

const SETTLE_MS = 280;

export function HeroReceipt({
  lexicon,
  worlds,
  home,
  labels,
}: {
  lexicon: WorldLexicon;
  worlds: Partial<Record<WorldId, StageWorld>>;
  /** The receipt before the visitor asks: the most recently checked price. */
  home: StageReceipt | null;
  labels: StageLabels;
}) {
  const index = useMemo(() => worldIndex(lexicon), [lexicon]);
  const intent = useSyncExternalStore(askIntent.subscribe, askIntent.get, askIntent.server);
  // The typed text settles before it moves the stage.
  const [settled, setSettled] = useState<WorldId | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const guess = detectWorld(intent.text, index)?.world ?? null;
      // Unclear words keep the current world while there is text; an empty box goes home.
      setSettled((cur) => guess ?? (intent.text.trim() ? cur : null));
    }, SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [intent.text, index]);

  // A hovered prompt first, then the world picked in the lists, then the typed words.
  const shown: SceneId = isWorld(intent.preview) ? intent.preview : intent.mode === 'choose' && isWorld(intent.chosen) ? intent.chosen : (settled ?? 'home');
  // Only a change slides a receipt in; the first one is simply there (state adjusted while rendering, React's pattern for derived state).
  const [last, setLast] = useState<SceneId>(shown);
  const [moved, setMoved] = useState(false);
  if (shown !== last) {
    setLast(shown);
    setMoved(true);
  }

  const info = shown === 'home' ? null : (worlds[shown] ?? null);
  const receipt = info ? info.receipt : home;
  return (
    <div className="stage" data-world={shown}>
      <span className="stage-shape stage-shape-1" aria-hidden="true" />
      <span className="stage-shape stage-shape-2" aria-hidden="true" />
      <span className="stage-shape stage-shape-3" aria-hidden="true" />
      {receipt && (
        <div key={shown} className="stage-ticket marks-light" data-new={moved ? '' : undefined}>
          <div className="stage-paper">
            <p className="stage-label">{labels.receipt}</p>
            <Link href={receipt.href} className="stage-tool" prefetch={false}>
              <ToolMark tool={receipt} world={shown} size={44} />
              <span className="min-w-0">
                <span className="stage-name">{receipt.name}</span>
                {receipt.plan && <span className="stage-plan">{labels.plan.replace('{name}', receipt.plan)}</span>}
              </span>
            </Link>
            <dl className="stage-rows">
              <div className="stage-row stage-row-price">
                <dt>{labels.price}</dt>
                <dd className="stage-price">{receipt.price}</dd>
              </div>
              {receipt.status && receipt.statusLabel && (
                <div className="stage-row">
                  <dt>{labels.status}</dt>
                  <dd className="stage-status" data-status={receipt.status}>
                    {receipt.statusLabel}
                  </dd>
                </div>
              )}
              {receipt.date && (
                <div className="stage-row">
                  <dt>{labels.seen}</dt>
                  <dd>
                    <time dateTime={receipt.dateIso ?? undefined}>{receipt.date}</time>
                  </dd>
                </div>
              )}
              {receipt.source && (
                <div className="stage-row">
                  <dt>{labels.source}</dt>
                  <dd>{receipt.source}</dd>
                </div>
              )}
            </dl>
            <p className="stage-note">{labels.note}</p>
          </div>
          <div className="stage-edge" aria-hidden="true" />
        </div>
      )}
      <div className="stage-caption">
        {info ? (
          <Link href={info.href} prefetch={false}>
            <span>{info.place}</span>
            <span className="stage-meta">
              {info.name} · {info.count}
            </span>
            <span className="stage-go">{labels.enter} →</span>
          </Link>
        ) : (
          <p>{labels.caption}</p>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {info ? labels.announce.replace('{place}', info.place) : ''}
      </p>
    </div>
  );
}
