import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  flat?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  flat = false,
}: EmptyStateProps) {
  return (
    <div className={flat ? 'empty-state' : 'card empty-state'}>
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {action || secondaryAction ? (
        <div className="empty-state-actions">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
