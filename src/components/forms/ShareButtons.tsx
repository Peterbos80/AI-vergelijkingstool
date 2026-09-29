'use client';
import { useState } from 'react';

/** Web Share where available, otherwise copy the link. */
export function ShareButtons({ url, text, labels }: { url: string; text: string; labels: { share: string; copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canShare && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void navigator.share({ url, text }).catch(() => undefined)}>
          {labels.share}
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() =>
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
      >
        {copied ? labels.copied : labels.copy}
      </button>
      <input readOnly value={url} aria-label={labels.copy} className="input h-8 min-h-0 w-full max-w-xs py-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}
