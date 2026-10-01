'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export function VideoFacadeClient({
  videoId,
  title,
  channel,
  playLabel,
  consent,
}: {
  videoId: string;
  title: string;
  channel: string | null;
  playLabel: string;
  consent: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="card overflow-hidden">
      <div className="relative aspect-video bg-paper-2">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label={playLabel}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex rounded-full bg-ink/85 px-4 py-2 text-paper group-hover:bg-ink">
                <Icon name="play" size={20} />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="p-3 text-sm">
        <span className="font-medium">{title}</span>
        {channel && <span className="block text-xs text-ink-3">{channel}</span>}
        {!playing && <span className="mt-1 block text-[0.6875rem] text-ink-3">{consent}</span>}
      </figcaption>
    </figure>
  );
}
