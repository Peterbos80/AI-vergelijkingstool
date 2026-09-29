'use client';
import { useActionState } from 'react';
import type { NewsletterState } from '@/app/[locale]/newsletter/actions';

export function NewsletterFormClient({
  action,
  locale,
  labels,
}: {
  action: (prev: NewsletterState | null, fd: FormData) => Promise<NewsletterState>;
  locale: string;
  labels: { email: string; consent: string; submit: string };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="nl-website">Website</label>
        <input id="nl-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="nl-email" className="label">
          {labels.email}
        </label>
        <input id="nl-email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" value="1" required className="mt-1 h-4 w-4 accent-[var(--ink)]" />
        <span>{labels.consent}</span>
      </label>
      <button type="submit" className="btn" disabled={pending}>
        {labels.submit}
      </button>
      <p role="status" aria-live="polite" className={`text-sm ${state?.ok ? 'text-verified' : 'text-danger'}`}>
        {state?.message}
      </p>
    </form>
  );
}
