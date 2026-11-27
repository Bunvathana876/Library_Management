import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
}

/** Resolve before the caller starts its mutation; cancellation never sends a request. */
export function useConfirmation() {
  const [pending, setPending] = useState<Confirmation | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const finish = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setPending(null);
    requestAnimationFrame(() => { if (openerRef.current?.isConnected) openerRef.current.focus(); });
  }, []);
  useEffect(() => () => { resolveRef.current?.(false); }, []);
  const confirm = useCallback((options: Confirmation) => {
    resolveRef.current?.(false);
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPending(options);
    return new Promise<boolean>((resolve) => { resolveRef.current = resolve; });
  }, []);
  const confirmationDialog = pending ? (
    <ConfirmDialog open title={pending.title} message={pending.message}
      confirmLabel={pending.confirmLabel} variant={pending.variant}
      onClose={() => finish(false)} onConfirm={() => finish(true)} />
  ) : null;
  return { confirm, confirmationDialog };
}
