import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  dot?: boolean;
}

export function StatusBadge({ tone, children, dot = true }: StatusBadgeProps) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
