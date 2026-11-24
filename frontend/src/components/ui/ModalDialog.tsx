import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
  children: ReactNode;
}

let cachedDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedDisplayTransition !== undefined) return cachedDisplayTransition;
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  dismissible = true,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closeWithAnimation = useCallback(async () => {
    const dialog = dialogRef.current;
    if (!dialog || !dialog.open || closingRef.current) return;

    if (!supportsTopLayerExit()) {
      closingRef.current = true;
      dialog.setAttribute('data-closing', '');
      const animations = typeof dialog.getAnimations === 'function' ? dialog.getAnimations({ subtree: true }) : [];
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((resolve) => window.setTimeout(resolve, 350)),
        ]);
      }
      dialog.removeAttribute('data-closing');
      closingRef.current = false;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.removeAttribute('data-closing');
      closingRef.current = false;
      dialog.showModal();
    } else if (!open && dialog.open) {
      void closeWithAnimation();
    }
  }, [open, closeWithAnimation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      // Reset returnValue so stale choices never leak across opens
      dialog.returnValue = '';
      dialog.removeAttribute('data-closing');
      closingRef.current = false;
      onCloseRef.current();
    };

    const handleCancel = (e: Event) => {
      if (!supportsTopLayerExit() && e.cancelable) {
        e.preventDefault();
        void closeWithAnimation();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [closeWithAnimation]);

  // Fallback for browsers without native <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !dismissible) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        void closeWithAnimation();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [dismissible, closeWithAnimation]);

  const sizeClass = size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : '';

  return (
    <dialog
      ref={dialogRef}
      className={`modal-dialog ${sizeClass}`.trim()}
      aria-labelledby={titleId}
      {...({ closedby: dismissible ? 'any' : 'closerequest' } as Record<string, string>)}
    >
      <div className="modal-header">
        <div>
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => void closeWithAnimation()}
          aria-label={`Close ${title}`}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
