import { AlertTriangle } from 'lucide-react';
import { ModalDialog } from '@/components/ui/ModalDialog';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  busy = false,
}: ConfirmDialogProps) {
  return (
    <ModalDialog open={open} onClose={onClose} title={title} size="sm" dismissible={false}>
      <div className="modal-body">
        <div className={variant === 'danger' ? 'alert alert-danger' : 'alert alert-info'}>
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{message}</span>
        </div>
      </div>
      <div className="modal-footer">
        {/* Safe action gets autofocus on confirmation dialogs */}
        <button
          type="button"
          className="btn btn-secondary"
          autoFocus
          onClick={onClose}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Processing…' : confirmLabel}
        </button>
      </div>
    </ModalDialog>
  );
}
