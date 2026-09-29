'use client';
import { useActionState } from 'react';
import type { LeadState } from '@/app/[locale]/doctor/actions';

export function LeadForm({
  action,
  locale,
  labels,
  sizes,
}: {
  action: (prev: LeadState | null, fd: FormData) => Promise<LeadState>;
  locale: string;
  labels: { name: string; email: string; company: string; size: string; message: string; consent: string; submit: string };
  sizes: { value: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  if (state?.ok) {
    return (
      <p role="status" className="text-verified">
        {state.message}
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="lead-website">Website</label>
        <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="lead-name" className="label">
            {labels.name}
          </label>
          <input id="lead-name" name="name" required autoComplete="name" className="input" />
        </div>
        <div>
          <label htmlFor="lead-email" className="label">
            {labels.email}
          </label>
          <input id="lead-email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="lead-company" className="label">
            {labels.company}
          </label>
          <input id="lead-company" name="company" autoComplete="organization" className="input" />
        </div>
        <div>
          <label htmlFor="lead-size" className="label">
            {labels.size}
          </label>
          <select id="lead-size" name="size" className="input" defaultValue="">
            <option value="" />
            {sizes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="lead-message" className="label">
          {labels.message}
        </label>
        <textarea id="lead-message" name="message" rows={3} maxLength={2000} className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" value="1" required className="mt-1 h-4 w-4 accent-[var(--ink)]" />
        <span>{labels.consent}</span>
      </label>
      <button type="submit" className="btn" disabled={pending}>
        {labels.submit}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
