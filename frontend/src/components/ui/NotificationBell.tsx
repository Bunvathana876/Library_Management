import { useId, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookCheck,
  CalendarClock,
  CheckCheck,
  Receipt,
} from 'lucide-react';
import type { NotificationItem, NotificationType } from '@/types/api';

interface NotificationBellProps {
  unreadCount: number;
  items: NotificationItem[];
  loading: boolean;
  onRefresh: () => void;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onNavigateToShelf: () => void;
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'HOLD_READY':
      return <BookCheck size={15} aria-hidden="true" style={{ color: 'var(--success)' }} />;
    case 'FINE_ASSESSED':
    case 'OVERDUE':
      return <Receipt size={15} aria-hidden="true" style={{ color: 'var(--danger)' }} />;
    case 'HOLD_EXPIRED':
      return <AlertCircle size={15} aria-hidden="true" style={{ color: 'var(--warning)' }} />;
    default:
      return <CalendarClock size={15} aria-hidden="true" style={{ color: 'var(--accent)' }} />;
  }
}

function formatRelativeTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function NotificationBell({
  unreadCount,
  items,
  loading,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onNavigateToShelf,
}: NotificationBellProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [busyAll, setBusyAll] = useState(false);

  const handleToggle = (e: React.SyntheticEvent<HTMLDivElement>) => {
    const toggleEvt = e.nativeEvent as ToggleEvent | undefined;
    if (toggleEvt?.newState === 'open') {
      onRefresh();
    }
  };

  const handleMarkAll = async () => {
    setBusyAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setBusyAll(false);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      await onMarkRead(item.id);
    }
    try {
      panelRef.current?.hidePopover?.();
    } catch {
      // Ignore if already closed
    }
    onNavigateToShelf();
  };

  return (
    <div className="notif-bell-wrap">
      <button
        type="button"
        className="btn btn-secondary btn-icon notif-trigger-btn"
        {...({ popoverTarget: panelId } as Record<string, string>)}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        title="Notifications"
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="notif-count-badge tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <div
        id={panelId}
        ref={panelRef}
        {...({ popover: 'auto' } as Record<string, string>)}
        className="notif-popover"
        aria-label="Notification center"
        onToggle={handleToggle}
      >
        <div className="notif-popover-header">
          <div>
            <div className="notif-popover-title">Notifications</div>
            <div className="table-subline">
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
            </div>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busyAll}
              onClick={() => void handleMarkAll()}
            >
              <CheckCheck size={14} aria-hidden="true" />
              <span>{busyAll ? 'Marking…' : 'Mark all read'}</span>
            </button>
          ) : null}
        </div>

        <div className="notif-popover-list">
          {loading && items.length === 0 ? (
            <p className="text-muted notif-empty-text">Loading alerts…</p>
          ) : items.length === 0 ? (
            <p className="text-muted notif-empty-text">
              No notifications yet. Ready holds, due-soon reminders, and overdue alerts appear here.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="notif-item-btn"
                data-unread={!item.readAt ? 'true' : undefined}
                onClick={() => void handleItemClick(item)}
              >
                <span className="notif-item-icon">{getTypeIcon(item.type)}</span>
                <span className="notif-item-body">
                  <span className="notif-item-top">
                    <span className="notif-item-title">{item.title}</span>
                    {!item.readAt ? <span className="notif-unread-dot" aria-label="Unread" /> : null}
                  </span>
                  <span className="notif-item-msg">{item.message}</span>
                  <span className="notif-item-time tabular-nums">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
