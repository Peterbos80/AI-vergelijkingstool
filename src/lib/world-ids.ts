/** The worlds: one per category, plus "home" (the wijzer's office). See components/worlds. */
export const WORLDS = ['assistant', 'writing', 'research', 'image', 'video', 'audio', 'code', 'automation', 'marketing', 'business'] as const;
export type WorldId = (typeof WORLDS)[number];
export type SceneId = WorldId | 'home';

export const isWorld = (id: string | null | undefined): id is WorldId => !!id && (WORLDS as readonly string[]).includes(id);
