'use client';

import { useFormStatus } from 'react-dom';

/** Submit button that disables itself while its form is pending. */
export function SubmitButton({ children, variant = 'primary', size = 'sm', name, value, confirm }: {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  name?: string;
  value?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const cls = ['btn', size === 'sm' ? 'btn-sm' : '', variant === 'ghost' ? 'btn-ghost' : '', variant === 'danger' ? 'btn-danger' : ''].join(' ');
  return (
    <button
      type="submit"
      className={cls}
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
