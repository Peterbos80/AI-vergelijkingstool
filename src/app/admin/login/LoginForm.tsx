'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export function LoginForm({ labels }: { labels: { email: string; password: string; submit: string; failed: string; rateLimited: string } }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null, email: '' });
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <p role="alert" id="login-error" className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-danger">
          {state.error === 'rateLimited' ? labels.rateLimited : labels.failed}
        </p>
      )}
      <div>
        <label className="label" htmlFor="email">
          {labels.email}
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" defaultValue={state.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {labels.password}
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
        {labels.submit}
      </button>
    </form>
  );
}
