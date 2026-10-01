'use client';
/**
 * Header search: a button (and the shortcuts "/" and Ctrl/Cmd+K) that opens a
 * small modal dialog with a GET form to the tool explorer, so the result page
 * is the same with or without JavaScript. Esc closes it and focus returns.
 */
import { useCallback, useEffect, useRef, type MouseEvent } from 'react';
import { Icon } from '@/components/ui/Icon';

export function SearchDialog({
  action,
  labels,
}: {
  action: string;
  labels: { button: string; label: string; placeholder: string; submit: string; close: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const show = useCallback(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    d.showModal();
    input.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      const palette = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey;
      const slash = e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (palette || slash) {
        e.preventDefault();
        show();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show]);

  // A click on the backdrop lands on the dialog itself (the panel is an inner element).
  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  };

  return (
    <>
      <button ref={button} type="button" className="header-btn search-btn" aria-haspopup="dialog" aria-keyshortcuts="/ Control+K Meta+K" onClick={show}>
        <Icon name="search" size={18} />
        <span className="search-btn-text">{labels.button}</span>
        <kbd className="search-btn-kbd" aria-hidden="true">
          /
        </kbd>
      </button>
      <dialog ref={dialog} className="search-dialog" aria-label={labels.label} onClose={() => button.current?.focus()} onClick={onBackdrop}>
        <search className="search-panel">
          <form action={action} method="get" className="search-form">
            <label htmlFor="site-search" className="visually-hidden">
              {labels.label}
            </label>
            <Icon name="search" size={20} className="text-ink-3" />
            <input
              ref={input}
              id="site-search"
              name="q"
              type="search"
              placeholder={labels.placeholder}
              autoComplete="off"
              enterKeyHint="search"
              className="search-input"
              onKeyDown={(e) => {
                // A search field clears itself on the first Esc; here Esc closes the dialog at once.
                if (e.key === 'Escape') {
                  e.preventDefault();
                  dialog.current?.close();
                }
              }}
            />
            <button type="submit" className="btn btn-sm">
              {labels.submit}
            </button>
            <button type="button" className="header-btn" onClick={() => dialog.current?.close()} aria-label={labels.close}>
              <Icon name="x" size={18} />
            </button>
          </form>
        </search>
      </dialog>
    </>
  );
}
