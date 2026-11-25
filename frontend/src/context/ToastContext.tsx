import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  announcement: string;
  notify: (input: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function isModalDialogOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [queued, setQueued] = useState<ToastItem[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const queuedRef = useRef<ToastItem[]>([]);
  queuedRef.current = queued;

  const announce = useCallback((item: ToastItem) => {
    const text = `${item.title}. ${item.message}`;
    if (typeof document.ariaNotify === 'function') {
      document.ariaNotify(text);
    } else {
      setAnnouncement('');
      window.setTimeout(() => setAnnouncement(text), 40);
    }
  }, []);

  const surfaceItems = useCallback(
    (items: ToastItem[]) => {
      if (items.length === 0) return;
      setToasts((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const fresh = items.filter((item) => !existingIds.has(item.id));
        return [...prev, ...fresh].slice(-2);
      });
      announce(items[items.length - 1]);
    },
    [announce],
  );

  const notify = useCallback(
    (input: Omit<ToastItem, 'id'>) => {
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const item: ToastItem = { ...input, id };
      if (isModalDialogOpen()) {
        // Suppress background toasts while a modal dialog is open; flush on close
        setQueued((prev) => [...prev, item]);
      } else {
        surfaceItems([item]);
      }
    },
    [surfaceItems],
  );

  // Flush queued notifications once modal dialogs close (outside setState updater!)
  useEffect(() => {
    if (queued.length === 0) return;

    const flushIfClear = () => {
      if (!isModalDialogOpen() && queuedRef.current.length > 0) {
        const itemsToSurface = queuedRef.current;
        queuedRef.current = [];
        setQueued([]);
        surfaceItems(itemsToSurface);
      }
    };

    const observer = new MutationObserver(flushIfClear);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
      childList: true,
    });

    const fallbackTimer = window.setInterval(flushIfClear, 250);
    return () => {
      observer.disconnect();
      window.clearInterval(fallbackTimer);
    };
  }, [queued.length, surfaceItems]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      announcement,
      notify,
      dismissToast,
    }),
    [toasts, announcement, notify, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
