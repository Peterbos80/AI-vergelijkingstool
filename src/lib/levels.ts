/**
 * Site-wide view level: "basis" (plain language, consumer facts) or
 * "advanced" (technical facts for developers). Stored per visitor in the
 * browser only, applied as <html data-level> before the first paint, and
 * read by CSS (.only-basis / .only-advanced), so it works on the static site
 * without JavaScript-rendered content. Without a stored choice: basis.
 */
export type ViewLevel = 'basis' | 'advanced';

export const LEVEL_KEY = 'aitw-level';
export const LEVEL_EVENT = 'aitw:level';

/** Runs in <head> before paint (with the request's CSP nonce). */
export const LEVEL_SCRIPT = `(function(){try{var l=localStorage.getItem('${LEVEL_KEY}');if(l==='advanced'||l==='basis')document.documentElement.setAttribute('data-level',l)}catch(e){}})();`;

/** Match's level constraint for a view level. */
export const MATCH_LEVEL: Record<ViewLevel, 'beginner' | 'advanced'> = { basis: 'beginner', advanced: 'advanced' };

export function readLevel(): ViewLevel {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-level') === 'advanced' ? 'advanced' : 'basis';
}

export function writeLevel(level: ViewLevel): void {
  document.documentElement.setAttribute('data-level', level);
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent(LEVEL_EVENT, { detail: level }));
}

export function subscribeLevel(onChange: () => void): () => void {
  // Another tab changed the level: follow it here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LEVEL_KEY) return;
    if (e.newValue === 'advanced' || e.newValue === 'basis') document.documentElement.setAttribute('data-level', e.newValue);
    onChange();
  };
  window.addEventListener(LEVEL_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LEVEL_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
