/**
 * Golden set: real use cases the engine must keep answering sensibly. Used by
 * the unit tests and by the Recommendation agent's nightly regression check
 * (docs/strategy/12 §8): a data change that breaks a case is reverted or escalated.
 */
import type { Locale } from '@/i18n/config';

export interface GoldenCase {
  id: string;
  query: string;
  locale: Locale;
  /** Acceptable task ids (first is preferred); [] = no task expected. */
  tasks: string[];
  expect?: {
    level?: 'beginner' | 'intermediate' | 'advanced';
    freeOnly?: boolean;
    budgetCents?: number;
    dutch?: boolean;
    local?: boolean;
    clarifyApproach?: boolean;
    noMatch?: boolean;
  };
}

export const GOLDEN: GoldenCase[] = [
  {
    id: 'journey-en',
    query: "I want to create professional social media videos but I don't know which AI tools to use.",
    locale: 'en',
    tasks: ['create-social-media-videos'],
    expect: { level: 'beginner', clarifyApproach: true },
  },
  {
    id: 'journey-nl',
    query: "Ik wil professionele social media video's maken maar weet niet welke AI-tools ik moet gebruiken",
    locale: 'nl',
    tasks: ['create-social-media-videos'],
    expect: { level: 'beginner', clarifyApproach: true },
  },
  { id: 'shorts', query: "Ik wil van lange video's automatisch TikToks maken", locale: 'nl', tasks: ['long-videos-to-shorts'] },
  { id: 'website-budget', query: 'website maken zonder code onder €20 per maand', locale: 'nl', tasks: ['build-website-no-code'], expect: { budgetCents: 2000 } },
  { id: 'meeting-notes', query: 'vergaderingen automatisch notuleren', locale: 'nl', tasks: ['automatic-meeting-notes'] },
  { id: 'product-photos-free', query: "productfoto's voor mijn webshop, gratis", locale: 'nl', tasks: ['create-product-photos'], expect: { freeOnly: true } },
  { id: 'support-bot', query: 'I need a chatbot for customer support on my website', locale: 'en', tasks: ['customer-support-chatbot'] },
  { id: 'seo-blogs', query: 'blogartikelen schrijven voor SEO', locale: 'nl', tasks: ['write-seo-blog-posts'] },
  { id: 'pitch-deck', query: 'make a pitch deck with AI', locale: 'en', tasks: ['make-presentations'] },
  { id: 'podcast', query: 'podcast opnemen en bewerken', locale: 'nl', tasks: ['produce-podcast'] },
  { id: 'music', query: 'achtergrondmuziek voor mijn youtube video', locale: 'nl', tasks: ['make-music'] },
  { id: 'dubbing', query: 'translate my videos to Spanish with dubbing', locale: 'en', tasks: ['translate-and-dub-videos'] },
  { id: 'thesis', query: 'wetenschappelijke bronnen zoeken voor mijn scriptie', locale: 'nl', tasks: ['literature-review', 'research-with-sources'] },
  { id: 'logo', query: 'logo ontwerpen voor mijn startup', locale: 'nl', tasks: ['design-logo-and-brand'] },
  { id: 'newsletter', query: 'send a newsletter, looking for a mailchimp alternative', locale: 'en', tasks: ['email-marketing'] },
  { id: 'csv', query: 'analyze a csv file without formulas', locale: 'en', tasks: ['analyze-data'] },
  { id: 'linkedin', query: 'linkedin posts schrijven voor mijn bedrijf', locale: 'nl', tasks: ['write-marketing-copy'] },
  { id: 'images', query: 'generate images for my website', locale: 'en', tasks: ['generate-images'] },
  {
    id: 'avatar-training',
    query: "trainingsvideo's maken met een AI-presentator, zonder zelf in beeld",
    locale: 'nl',
    tasks: ['training-videos-ai-presenter'],
  },
  { id: 'dutch-voiceover', query: 'voice-over in het Nederlands voor mijn video', locale: 'nl', tasks: ['create-ai-voiceovers'], expect: { dutch: true } },
  { id: 'developer', query: 'ik ben developer en wil sneller programmeren met ai', locale: 'nl', tasks: ['code-with-ai'], expect: { level: 'advanced' } },
  { id: 'local-llm', query: 'run an LLM locally on my own computer for privacy', locale: 'en', tasks: ['local-private-ai'], expect: { local: true } },
  { id: 'transcribe', query: 'interview uitschrijven', locale: 'nl', tasks: ['transcribe-audio'] },
  { id: 'schedule', query: 'social media posts inplannen', locale: 'nl', tasks: ['plan-social-media'] },
  { id: 'automation', query: 'werk automatiseren, zapier alternatief', locale: 'nl', tasks: ['automate-work'] },
  { id: 'no-code-app', query: 'app bouwen zonder te programmeren', locale: 'nl', tasks: ['build-app-without-code'] },
  { id: 'nonsense', query: 'qwxz blorp vrrt', locale: 'en', tasks: [], expect: { noMatch: true } },
];
