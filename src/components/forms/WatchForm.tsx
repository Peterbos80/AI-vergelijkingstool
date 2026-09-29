'use client';
import { useActionState } from 'react';
import type { FormState } from '@/app/[locale]/stack/[id]/actions';

/** E-mail opt-in with explicit consent checkboxes (double opt-in follows by e-mail). */
export function WatchForm({
  action,
  hidden,
  labels,
  withNewsletter = true,
}: {
  action: (prev: FormState | null, fd: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  labels: { email: string; consent: string; newsletter: string; submit: string };
  withNewsletter?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div>
        <label htmlFor="watch-email" className="label">
          {labels.email}
        </label>
        <input id="watch-email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" value="1" required className="mt-1 h-4 w-4 accent-[var(--ink)]" />
        <span>{labels.consent}</span>
      </label>
      {withNewsletter && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="newsletter" value="1" className="mt-1 h-4 w-4 accent-[var(--ink)]" />
          <span>{labels.newsletter}</span>
        </label>
      )}
      <button type="submit" className="btn" disabled={pending}>
        {labels.submit}
      </button>
      <p role="status" aria-live="polite" className={`text-sm ${state?.ok ? 'text-verified' : 'text-danger'}`}>
        {state?.message}
      </p>
    </form>
  );
}
