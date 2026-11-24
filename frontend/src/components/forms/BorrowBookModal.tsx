import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CalendarClock } from 'lucide-react';
import { loansApi } from '@/api/loansApi';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useToast } from '@/context/ToastContext';
import type { Book, LoanResponse, Member } from '@/types/api';
import { formatCalendarDate, previewDueDate, todayPlainDate } from '@/utils/dates';
import { formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';

interface BorrowBookModalProps {
  open: boolean;
  books: Book[];
  members: Member[];
  initialBookId?: number | null;
  initialMemberId?: number | null;
  onClose: () => void;
  onBorrowed: (loan: LoanResponse) => void;
}

export function BorrowBookModal({
  open,
  books,
  members,
  initialBookId = null,
  initialMemberId = null,
  onClose,
  onBorrowed,
}: BorrowBookModalProps) {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const availableBooks = useMemo(() => books.filter((b) => b.available), [books]);

  const [bookId, setBookId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  useEffect(() => {
    if (!open) return;
    const defaultBook =
      initialBookId && availableBooks.some((b) => b.id === initialBookId)
        ? String(initialBookId)
        : availableBooks[0]
          ? String(availableBooks[0].id)
          : '';
    const defaultMember =
      initialMemberId && members.some((m) => m.id === initialMemberId)
        ? String(initialMemberId)
        : members[0]
          ? String(members[0].id)
          : '';
    setBookId(defaultBook);
    setMemberId(defaultMember);
    setErrorMsg(null);
    setSummaryErrors([]);
    if (formRef.current) {
      return installFormValidationAria(formRef.current);
    }
  }, [open, initialBookId, initialMemberId, availableBooks, members]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const collected: SummaryErrorItem[] = [];
      if (!bookId) {
        collected.push({
          fieldId: 'borrow-book-select',
          label: 'Available Book',
          message: 'Select an available book.',
        });
      }
      if (!memberId) {
        collected.push({
          fieldId: 'borrow-member-select',
          label: 'Borrower Member',
          message: 'Select a registered member.',
        });
      }
      setSummaryErrors(collected);
      return;
    }

    setSummaryErrors([]);
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const loan = await loansApi.borrowBook({
        bookId: Number(bookId),
        memberId: Number(memberId),
      });
      onBorrowed(loan);
      onClose();
      notify({
        variant: 'success',
        title: 'Book checked out',
        message: `Loan #${loan.id}: "${loan.bookTitle}" issued to ${loan.memberName}.`,
      });
    } catch (err) {
      setErrorMsg(formatApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const canBorrow = availableBooks.length > 0 && members.length > 0;
  const checkoutToday = formatCalendarDate(todayPlainDate().toString());
  const calculatedDue = previewDueDate(14);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Issue New Book Loan"
      subtitle="Checkout an available book to a registered library member (14-day loan period)."
    >
      <form ref={formRef} className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="modal-body form-stack">
          <ErrorSummary errors={summaryErrors} />

          {errorMsg ? (
            <div className="alert alert-danger" role="alert">
              <AlertCircle size={18} aria-hidden="true" className="alert-icon" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {availableBooks.length === 0 ? (
            <div className="alert alert-warning">
              <span>No books are currently available for checkout. Return a loan or add a book first.</span>
            </div>
          ) : null}

          {members.length === 0 ? (
            <div className="alert alert-warning">
              <span>No members are registered yet. Register a library member before issuing a loan.</span>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="borrow-book-select">
              Available Book
            </label>
            <span id="borrow-book-hint" className="field-hint">
              Only currently available volumes are eligible for checkout.
            </span>
            <select
              id="borrow-book-select"
              name="bookId"
              className="select-control"
              required
              autoFocus
              disabled={availableBooks.length === 0}
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              aria-describedby="borrow-book-hint"
              data-error="borrow-book-error"
            >
              {availableBooks.length === 0 ? (
                <option value="">No available books</option>
              ) : (
                availableBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    #{b.id} — {b.title} ({b.author}, {b.publicationYear})
                  </option>
                ))
              )}
            </select>
            <div id="borrow-book-error" className="field-error">
              Select an available book.
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="borrow-member-select">
              Borrower Member
            </label>
            <span id="borrow-member-hint" className="field-hint">
              Choose the registered member borrowing this title.
            </span>
            <select
              id="borrow-member-select"
              name="memberId"
              className="select-control"
              required
              disabled={members.length === 0}
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              aria-describedby="borrow-member-hint"
              data-error="borrow-member-error"
            >
              {members.length === 0 ? (
                <option value="">No registered members</option>
              ) : (
                members.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} — {m.fullName} ({m.email})
                  </option>
                ))
              )}
            </select>
            <div id="borrow-member-error" className="field-error">
              Select a registered member.
            </div>
          </div>

          <div className="alert alert-info">
            <CalendarClock size={18} aria-hidden="true" className="alert-icon" />
            <span>
              14-day term: <strong>{checkoutToday}</strong> → Due <strong>{calculatedDue}</strong>.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !canBorrow}>
            {submitting ? 'Issuing Loan…' : 'Confirm Borrow'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
