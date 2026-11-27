import { useRef, useState } from 'react';
import { AlertCircle, BookOpen } from 'lucide-react';
import { memberPortalApi } from '@/api/memberPortalApi';
import { ModalDialog } from '@/components/ui/ModalDialog';
import type { Book, LoanResponse } from '@/types/api';
import { formatApiErrorMessage } from '@/utils/errors';

interface MemberBorrowModalProps {
  book: Book;
  email: string;
  onClose: () => void;
  onBorrowed: (loan: LoanResponse) => void;
}

export function MemberBorrowModal({ book, email, onClose, onBorrowed }: MemberBorrowModalProps) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmBorrow = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const loan = await memberPortalApi.borrowBook(book.id);
      onBorrowed(loan);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <ModalDialog open title="Borrow this book?" subtitle="Confirm your 14-day library loan" size="sm" onClose={onClose} dismissible={!busy}>
      <div className="modal-body form-stack">
        <div>
          <h3 className="card-title">{book.title}</h3>
          <p className="card-subtitle">{book.author}</p>
        </div>
        <p>This loan will belong to your account: <strong>{email}</strong>.</p>
        <div className="alert alert-info">
          <BookOpen size={18} aria-hidden="true" className="alert-icon" />
          <span>An available copy will be assigned to you for 14 days. Your due date and loan details will appear in My Bookshelf.</span>
        </div>
        {error ? (
          <div className="alert alert-danger" role="alert">
            <AlertCircle size={18} aria-hidden="true" className="alert-icon" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={() => void confirmBorrow()} disabled={busy}>
          {busy ? 'Borrowing…' : 'Confirm Borrow'}
        </button>
      </div>
    </ModalDialog>
  );
}
