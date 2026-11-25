import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '@/components/ui/NotificationBell';
import type { NotificationItem } from '@/types/api';

describe('NotificationBell', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders unread count, exposes native auto popover without ARIA menu roles, and marks notifications read', async () => {
    const items: NotificationItem[] = [
      {
        id: 1,
        type: 'HOLD_READY',
        title: 'Hold ready for pickup: Clean Code',
        message: 'Copy CPY-0001-01 is held at the desk.',
        readAt: null,
        createdAt: new Date().toISOString(),
      },
    ];
    const onMarkRead = vi.fn().mockResolvedValue(undefined);
    const onMarkAllRead = vi.fn().mockResolvedValue(undefined);
    const onNavigate = vi.fn();

    await act(async () => {
      root.render(
        <NotificationBell
          unreadCount={1}
          items={items}
          loading={false}
          onRefresh={vi.fn()}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onNavigateToShelf={onNavigate}
        />,
      );
    });

    const trigger = container.querySelector('.notif-trigger-btn') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-haspopup')).toBeNull();
    expect(container.querySelector('.notif-count-badge')?.textContent).toBe('1');

    const panel = container.querySelector('.notif-popover') as HTMLDivElement;
    expect(panel.getAttribute('popover')).toBe('auto');
    expect(panel.getAttribute('role')).toBeNull();

    const itemBtn = container.querySelector('.notif-item-btn') as HTMLButtonElement;
    await act(async () => {
      itemBtn.click();
    });
    expect(onMarkRead).toHaveBeenCalledWith(1);
    expect(onNavigate).toHaveBeenCalledTimes(1);

    const markAllBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mark all read'),
    ) as HTMLButtonElement;
    await act(async () => {
      markAllBtn.click();
    });
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });
});
