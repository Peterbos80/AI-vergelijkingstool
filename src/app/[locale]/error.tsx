'use client';
import { useEffect } from 'react';

/**
 * Route error boundary. Strings are bilingual by design: this component
 * cannot load server messages, and the locale is read from the URL.
 */
const TEXT = {
  nl: { title: 'Er ging iets mis.', body: 'We hebben de fout gelogd. Probeer het opnieuw.', retry: 'Opnieuw proberen' },
  en: { title: 'Something went wrong.', body: "We've logged the error. Please try again.", retry: 'Try again' },
} as const;

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server errors are logged server-side; this surfaces client-only errors in the console.
    console.error(error);
  }, [error]);
  const locale = typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? 'en' : 'nl';
  const t = TEXT[locale];
  return (
    <div className="container-page py-24">
      <h1 className="text-3xl">{t.title}</h1>
      <p className="mt-3 text-ink-2">{t.body}</p>
      {error.digest && <p className="mono mt-2 text-xs text-ink-3">ref: {error.digest}</p>}
      <button type="button" className="btn mt-8" onClick={reset}>
        {t.retry}
      </button>
    </div>
  );
}
