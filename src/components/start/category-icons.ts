import type { IconName } from '@/components/ui/Icon';

/** One icon per category (components/ui/Icon), always next to the category's name. */
export const CATEGORY_ICON: Record<string, IconName> = {
  assistant: 'message-square',
  writing: 'pen-line',
  research: 'book-open',
  image: 'image',
  video: 'clapperboard',
  audio: 'audio-lines',
  code: 'code-xml',
  automation: 'workflow',
  marketing: 'megaphone',
  business: 'headset',
};
