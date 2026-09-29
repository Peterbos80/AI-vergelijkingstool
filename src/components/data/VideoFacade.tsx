import type { Translator } from '@/i18n/format';
import { VideoFacadeClient } from './VideoFacadeClient';

/** YouTube facade: thumbnail first; the (nocookie) player loads only after a click. */
export function VideoFacade({ videoId, title, channel, t }: { videoId: string; title: string; channel: string | null; t: Translator }) {
  return <VideoFacadeClient videoId={videoId} title={title} channel={channel} playLabel={t('video.play', { title })} consent={t('video.consent')} />;
}
