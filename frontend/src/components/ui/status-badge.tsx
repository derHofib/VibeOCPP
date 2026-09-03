import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  neutral: 'bg-surface text-text-muted border border-border',
};

// Icons carry the same distinction as color so status is never color-only
// (WCAG SC 1.4.1) — a colorblind viewer still tells success from danger by
// shape. Kept as small inline paths rather than an icon library dependency.
const toneIcons: Record<StatusTone, ReactNode> = {
  success: (
    <path d="M5 10.5 8.5 14 15 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  warning: (
    <path
      d="M10 3.5 17.5 16h-15L10 3.5ZM10 8.5v3.5M10 14.5h.01"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  danger: (
    <path d="M6 6l8 8M14 6l-8 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  info: (
    <path
      d="M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 9v4.5M10 6.5h.01"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  neutral: <circle cx="10" cy="10" r="3" />,
};

export interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        {toneIcons[tone]}
      </svg>
      {children}
    </span>
  );
}
