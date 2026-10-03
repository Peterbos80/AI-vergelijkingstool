'use client';
/**
 * The menu below 1024px: a button that opens a full-screen modal dialog with
 * the server-rendered navigation as children. Esc, the close button or
 * following a link closes it, and focus returns to the menu button.
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

export function SiteMenu({ labels, brand, children }: { labels: { menu: string; open: string; close: string }; brand: ReactNode; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();

  // The menu belongs to small screens: close it when the viewport grows past the breakpoint.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 64rem)');
    const onChange = () => {
      if (mq.matches) dialog.current?.close();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open]);

  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    // The header stays mounted on client navigation, so a followed link closes the menu.
    if ((e.target as Element).closest('a[href]')) close();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="header-btn menu-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={labels.open}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <Icon name="menu" size={20} />
        <span className="menu-btn-text">{labels.menu}</span>
      </button>
      <dialog
        ref={dialog}
        id="site-menu"
        className="site-menu"
        aria-label={labels.menu}
        onClose={() => {
          setOpen(false);
          button.current?.focus();
        }}
        onClick={onClick}
      >
        <div className="site-menu-inner">
          <div className="site-menu-head">
            {brand}
            <button type="button" className="header-btn" onClick={close} aria-label={labels.close}>
              <Icon name="x" size={20} />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
