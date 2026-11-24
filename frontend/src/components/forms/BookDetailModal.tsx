import { useEffect, useState } from 'react';
import { BookOpen, Calendar, Pencil, Repeat, Trash2, User } from 'lucide-react';
import { booksApi } from '@/api/booksApi';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import type { Book } from '@/types/api';
import { formatApiErrorMessage } from '@/utils/errors';
import { formatCallNumber } from '@/utils/formatting';

interface BookDetailModalProps {
  bookId: number | null;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onBorrow: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export function BookDetailModal({
  bookId,
  onClose,
  onEdit,
  onBorrow,
  onDelete,
}: BookDetailModalProps) {
  const { isStaff } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
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
      subtitle="Live details retrieved from GET /api/books/{id}"
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
            <div className="detail-plaque">
              <div className="queue-row-top">
                <span className="badge badge-neutral mono">{formatCallNumber(book.id)}</span>
                <span className="badge badge-neutral mono">ID #{book.id}</span>
              </div>
              <StatusBadge tone={book.available ? 'success' : 'warning'}>
                {book.available ? 'Available for Checkout' : 'Currently Borrowed'}
              </StatusBadge>
            </div>

            <div className="detail-meta-grid">
              <div className="detail-meta-item" style={{ gridColumn: '1 / -1' }}>
                <BookOpen size={17} aria-hidden="true" className="detail-meta-icon" />
                <div>
                  <div className="field-hint">Title</div>
                  <div className="serif-display" style={{ fontSize: '1.15rem', fontWeight: 600 }}>
                    {book.title}
                  </div>
                </div>
              </div>

              <div className="detail-meta-item">
                <User size={17} aria-hidden="true" className="detail-meta-icon" />
                <div>
                  <div className="field-hint">Author</div>
                  <div className="queue-row-title">{book.author}</div>
                </div>
              </div>

              <div className="detail-meta-item">
                <Calendar size={17} aria-hidden="true" className="detail-meta-icon" />
                <div>
                  <div className="field-hint">Publication Year</div>
                  <div className="tabular-nums queue-row-title">{book.publicationYear}</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className={`modal-footer ${isStaff && book ? 'modal-footer-split' : ''}`.trim()}>
        {isStaff && book ? (
          <div className="row-actions">
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
            {book.available ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onBorrow(book);
                }}
              >
                <Repeat size={15} aria-hidden="true" />
                <span>Borrow</span>
              </button>
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
