'use client';
import { useActionState } from 'react';
import type { CorrectionState } from '@/app/[locale]/corrections/actions';

export function CorrectionForm({
  action,
  locale,
  tools,
  fields,
  labels,
  defaultTool,
}: {
  action: (prev: CorrectionState | null, fd: FormData) => Promise<CorrectionState>;
  locale: string;
  tools: { slug: string; name: string }[];
  fields: { value: string; label: string }[];
  labels: { tool: string; field: string; correct: string; source: string; email: string; vendor: string; submit: string };
  defaultTool?: string;
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
        <label htmlFor="corr-website">Website</label>
        <input id="corr-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="corr-tool" className="label">
            {labels.tool}
          </label>
          <select id="corr-tool" name="tool" required defaultValue={defaultTool ?? ''} className="input">
            <option value="" />
            {tools.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="corr-field" className="label">
            {labels.field}
          </label>
          <select id="corr-field" name="field" className="input" defaultValue="price">
            {fields.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="corr-correct" className="label">
          {labels.correct}
        </label>
        <textarea id="corr-correct" name="correct" required minLength={3} maxLength={1500} rows={3} className="input" />
      </div>
      <div>
        <label htmlFor="corr-source" className="label">
          {labels.source}
        </label>
        <input id="corr-source" name="source" type="url" required placeholder="https://" className="input" />
      </div>
      <div>
        <label htmlFor="corr-email" className="label">
          {labels.email}
        </label>
        <input id="corr-email" name="email" type="email" autoComplete="email" className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vendor" value="1" className="h-4 w-4 accent-[var(--ink)]" />
        {labels.vendor}
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
