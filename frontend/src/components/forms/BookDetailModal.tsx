import { useEffect, useState } from 'react';
import { Clock, Pencil, Repeat, Trash2 } from 'lucide-react';
import { booksApi } from '@/api/booksApi';
import { BookCoverImage } from '@/components/ui/BookCoverImage';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { QrCodeCanvas } from '@/components/ui/QrCodeCanvas';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import type { Book, HoldResponse } from '@/types/api';
import { formatApiErrorMessage } from '@/utils/errors';
import { formatCallNumber } from '@/utils/formatting';

interface BookDetailModalProps {
  bookId: number | null;
  myActiveHolds?: HoldResponse[];
  onClose: () => void;
  onEdit: (book: Book) => void;
  onBorrow: (book: Book) => void;
  onDelete: (book: Book) => void;
  onPlaceHold?: (book: Book) => Promise<void>;
}

export function BookDetailModal({
  bookId,
  myActiveHolds = [],
  onClose,
  onEdit,
  onBorrow,
  onDelete,
  onPlaceHold,
}: BookDetailModalProps) {
  const { isAuthenticated, isStaff } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bookId === null) {
      setBook(null);
      setErrorMsg(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg(null);

    booksApi
      .getBook(bookId, controller.signal)
      .then((data) => setBook(data))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setErrorMsg(formatApiErrorMessage(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [bookId]);

  return (
    <ModalDialog
      open={bookId !== null}
      onClose={onClose}
      title={book ? book.title : `Book Record #${bookId ?? ''}`}
      subtitle="Catalog record details"
    >
      <div className="modal-body form-stack">
        {loading ? (
          <DetailSkeleton />
        ) : errorMsg ? (
          <div className="alert alert-danger" role="alert">
            <span>{errorMsg}</span>
          </div>
        ) : book ? (
          <>
            <div className="book-detail-header-card">
              <div className="book-detail-cover" aria-hidden="true">
                <BookCoverImage
                  book={book}
                  width={92}
                  height={122}
                  className="book-detail-cover-img"
                />
              </div>
              <div className="book-detail-summary">
                <div className="queue-row-top">
                  <span className="catalog-id-badge mono">{formatCallNumber(book.id)}</span>
                  <span className="badge badge-neutral mono">Record #{book.id}</span>
                </div>
                <p className="book-detail-author">
                  {book.author} · <span className="tabular-nums">{book.publicationYear}</span>
                </p>
                <div className="queue-row-top">
                  <StatusBadge
                    tone={book.available ? 'success' : book.reservedForPickup ? 'info' : 'warning'}
                  >
                    {book.available
                      ? 'Available for Checkout'
                      : book.reservedForPickup
                        ? 'Held at Circulation Desk'
                        : 'Currently Borrowed'}
                  </StatusBadge>
                  {(book.activeHoldCount ?? 0) > 0 ? (
                    <span className="badge badge-warning tabular-nums">
                      {book.activeHoldCount} active{' '}
                      {book.activeHoldCount === 1 ? 'hold' : 'holds'}
                    </span>
                  ) : null}
                </div>
              </div>
              <QrCodeCanvas
                value={book.isbn || formatCallNumber(book.id)}
                size={76}
                label={`Catalog QR for ${book.title}`}
              />
            </div>

            <dl className="detail-meta-list">
              <div className="detail-meta-row">
                <dt className="detail-meta-term">Author</dt>
                <dd className="detail-meta-value">{book.author}</dd>
              </div>
              <div className="detail-meta-row">
                <dt className="detail-meta-term">Publication Year</dt>
                <dd className="detail-meta-value tabular-nums">{book.publicationYear}</dd>
              </div>
              <div className="detail-meta-row">
                <dt className="detail-meta-term">Publisher</dt>
                <dd className="detail-meta-value">
                  {book.publisher ? book.publisher : <span className="text-muted">Not specified</span>}
                </dd>
              </div>
              <div className="detail-meta-row">
                <dt className="detail-meta-term">ISBN</dt>
                <dd className="detail-meta-value mono">
                  {book.isbn ? book.isbn : <span className="text-muted">Not specified</span>}
                </dd>
              </div>
              <div className="detail-meta-row">
                <dt className="detail-meta-term">Call Number</dt>
                <dd className="detail-meta-value mono">{formatCallNumber(book.id)}</dd>
              </div>
              <div className="detail-meta-row">
                <dt className="detail-meta-term">Availability</dt>
                <dd className="detail-meta-value">
                  {book.available
                    ? 'On shelf and ready to borrow'
                    : book.reservedForPickup
                      ? 'Returned and reserved at the circulation desk'
                      : 'Checked out by a member'}
                </dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>

      <div
        className={`modal-footer ${
          book && (isStaff || (!book.available && isAuthenticated && onPlaceHold))
            ? 'modal-footer-split'
            : ''
        }`.trim()}
      >
        {book ? (
          <div className="row-actions">
            {isStaff ? (
              <>
                <button
                  type="button"
                  className="btn btn-soft-danger btn-sm"
                  onClick={() => {
                    onClose();
                    onDelete(book);
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onClose();
                    onEdit(book);
                  }}
                >
                  <Pencil size={15} aria-hidden="true" />
                  <span>Edit</span>
                </button>
                {book.available || book.reservedForPickup ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onClose();
                      onBorrow(book);
                    }}
                  >
                    <Repeat size={15} aria-hidden="true" />
                    <span>{book.reservedForPickup ? 'Pickup Checkout' : 'Borrow'}</span>
                  </button>
                ) : null}
              </>
            ) : null}

            {!book.available && isAuthenticated && onPlaceHold ? (
              (() => {
                const existingHold = myActiveHolds.find((h) => h.bookId === book.id);
                if (existingHold) {
                  return (
                    <StatusBadge
                      tone={existingHold.status === 'READY_FOR_PICKUP' ? 'success' : 'warning'}
                    >
                      {existingHold.status === 'READY_FOR_PICKUP'
                        ? 'Ready for you at desk'
                        : `In Holds Queue (#${existingHold.queuePosition})`}
                    </StatusBadge>
                  );
                }
                return (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={holding}
                    onClick={async () => {
                      setHolding(true);
                      try {
                        await onPlaceHold(book);
                      } finally {
                        setHolding(false);
                      }
                    }}
                  >
                    <Clock size={15} aria-hidden="true" />
                    <span>{holding ? 'Placing Hold…' : 'Place Hold'}</span>
                  </button>
                );
              })()
            ) : null}
          </div>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalDialog>
  );
}
