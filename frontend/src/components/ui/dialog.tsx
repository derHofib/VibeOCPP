import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

// Wraps the native <dialog> element rather than hand-rolling focus-trap and
// Escape-to-close logic: the browser already provides both (plus a
// backdrop) for a <dialog> opened via showModal().
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={cn(
        'w-full max-w-md rounded-lg border border-border bg-surface-raised p-0 text-text',
        'backdrop:bg-black/40',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M5 5l10 10M15 5 5 15" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
