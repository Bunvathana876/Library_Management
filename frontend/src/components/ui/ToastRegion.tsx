import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast, type ToastItem } from '@/context/ToastContext';

function ToastCard({
  item,
  onDismiss,
  onUserDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
  onUserDismiss: (id: string, element: HTMLElement | null) => void;
}) {
  const pausedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const scheduleDismiss = (delayMs: number) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      if (!pausedRef.current) {
        onDismiss(item.id);
      }
    }, delayMs);
  };

  useEffect(() => {
    scheduleDismiss(item.variant === 'error' ? 5000 : 3400);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [item.id, item.variant, onDismiss]);

  const Icon =
    item.variant === 'success' ? CheckCircle2 : item.variant === 'error' ? AlertCircle : Info;

  const iconColor =
    item.variant === 'success'
      ? 'var(--success)'
      : item.variant === 'error'
        ? 'var(--danger)'
        : 'var(--accent)';

  return (
    <div
      className="toast-card"
      data-variant={item.variant}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
        scheduleDismiss(2500);
      }}
      onFocus={() => {
        pausedRef.current = true;
      }}
      onBlur={() => {
        pausedRef.current = false;
        scheduleDismiss(2500);
      }}
    >
      <Icon
        size={18}
        aria-hidden="true"
        style={{ color: iconColor, flexShrink: 0, marginTop: '2px' }}
      />
      <div className="toast-content">
        <div className="toast-title">{item.title}</div>
        <div className="toast-message">{item.message}</div>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={`Close notification: ${item.title}`}
        onClick={(e) => onUserDismiss(item.id, e.currentTarget)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastRegion() {
  const { toasts, announcement, dismissToast } = useToast();
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;

    if (toasts.length > 0) {
      try {
        if (typeof region.showPopover === 'function') {
          if (!region.matches(':popover-open')) {
            region.showPopover();
          }
        } else {
          region.classList.add(':popover-open');
        }
      } catch {
        region.classList.add(':popover-open');
      }
    } else {
      try {
        region.hidePopover?.();
      } catch {
        // Ignore if already hidden
      }
      region.classList.remove(':popover-open');
    }
  }, [toasts.length]);

  const handleUserDismiss = (id: string, buttonEl: HTMLElement | null) => {
    const remainingButtons = Array.from(
      regionRef.current?.querySelectorAll<HTMLButtonElement>('.toast-card button') ?? [],
    ).filter((btn) => btn !== buttonEl);

    dismissToast(id);

    window.requestAnimationFrame(() => {
      if (remainingButtons.length > 0) {
        remainingButtons[0].focus();
      }
    });
  };

  return (
    <>
      <p className="visually-hidden">Screen reader announcements</p>
      <div id="toast-live-announcer" aria-live="polite" className="visually-hidden">
        {announcement}
      </div>
      <div
        ref={regionRef}
        role="region"
        aria-label="Notifications"
        className="toast-region"
        {...({ popover: 'manual' } as Record<string, string>)}
      >
        {toasts.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            onDismiss={dismissToast}
            onUserDismiss={handleUserDismiss}
          />
        ))}
      </div>
    </>
  );
}
