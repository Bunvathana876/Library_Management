import { useEffect, useState, type FormEvent } from 'react';
import { Clock, Layers, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { booksApi } from '@/api/booksApi';
import { BookCoverImage } from '@/components/ui/BookCoverImage';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { QrCodeCanvas } from '@/components/ui/QrCodeCanvas';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Book, BookCopyResponse, BookCopyStatus, HoldResponse } from '@/types/api';
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
  onCopiesChanged?: () => void;
}

function copyStatusTone(status: BookCopyStatus): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'AVAILABLE':
      return 'success';
    case 'ON_HOLD':
      return 'info';
    case 'LOANED':
      return 'warning';
    case 'DAMAGED':
    case 'LOST':
      return 'danger';
  }
}

export function BookDetailModal({
  bookId,
  myActiveHolds = [],
  onClose,
  onEdit,
  onBorrow,
  onDelete,
  onPlaceHold,
  onCopiesChanged,
}: BookDetailModalProps) {
  const { isAuthenticated, isStaff } = useAuth();
  const { notify } = useToast();

  const [book, setBook] = useState<Book | null>(null);
  const [copies, setCopies] = useState<BookCopyResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showAddCopy, setShowAddCopy] = useState(false);
  const [newCopyBarcode, setNewCopyBarcode] = useState('');
  const [newCopyShelf, setNewCopyShelf] = useState('');
  const [newCopyNotes, setNewCopyNotes] = useState('');
  const [copyBusyId, setCopyBusyId] = useState<number | 'add' | null>(null);

  const refreshBookAndCopies = async (targetId: number, signal?: AbortSignal) => {
    const [bookData, copyList] = await Promise.all([
      booksApi.getBook(targetId, signal),
      booksApi.listCopies(targetId, signal).catch(() => []),
    ]);
    if (!signal?.aborted) {
      setBook(bookData);
      setCopies(copyList);
    }
  };

  useEffect(() => {
    if (bookId === null) {
      setBook(null);
      setCopies([]);
      setErrorMsg(null);
      setShowAddCopy(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg(null);
    setShowAddCopy(false);

    refreshBookAndCopies(bookId, controller.signal)
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

  const handleAddCopy = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!book) return;
    setCopyBusyId('add');
    try {
      const created = await booksApi.addCopy(book.id, {
        barcode: newCopyBarcode.trim() || null,
        shelfLocation: newCopyShelf.trim() || book.shelfLocation || null,
        conditionNotes: newCopyNotes.trim() || null,
      });
      setNewCopyBarcode('');
      setNewCopyShelf('');
      setNewCopyNotes('');
      setShowAddCopy(false);
      await refreshBookAndCopies(book.id);
      onCopiesChanged?.();
      notify({
        variant: 'success',
        title: 'Copy added',
        message: `Added copy ${created.barcode} to "${book.title}".`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Could not add copy',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setCopyBusyId(null);
    }
  };

  const handleCopyStatusChange = async (copy: BookCopyResponse, nextStatus: BookCopyStatus) => {
    if (!book) return;
    setCopyBusyId(copy.id);
    try {
      await booksApi.updateCopy(book.id, copy.id, {
        status: nextStatus,
        shelfLocation: copy.shelfLocation,
        conditionNotes: copy.conditionNotes,
      });
      await refreshBookAndCopies(book.id);
      onCopiesChanged?.();
      notify({
        variant: 'info',
        title: 'Copy updated',
        message: `${copy.barcode} marked as ${nextStatus}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Update failed',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setCopyBusyId(null);
    }
  };

  const handleDeleteCopy = async (copy: BookCopyResponse) => {
    if (!book) return;
    setCopyBusyId(copy.id);
    try {
      await booksApi.deleteCopy(book.id, copy.id);
      await refreshBookAndCopies(book.id);
      onCopiesChanged?.();
      notify({
        variant: 'success',
        title: 'Copy removed',
        message: `Removed copy ${copy.barcode}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Cannot remove copy',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setCopyBusyId(null);
    }
  };

  const totalCopies = book?.totalCopies ?? (copies.length || 1);
  const availableCopies = book?.availableCopies ?? (book?.available ? 1 : 0);

  return (
    <ModalDialog
      open={bookId !== null}
      onClose={onClose}
      size="lg"
      title={book ? book.title : `Book Record #${bookId ?? ''}`}
      subtitle="Catalog record & copy inventory details"
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
                  {book.category ? <span className="badge badge-info">{book.category}</span> : null}
                </div>
                <p className="book-detail-author">
                  {book.author} · <span className="tabular-nums">{book.publicationYear}</span>
                </p>
                <div className="queue-row-top">
                  <StatusBadge
                    tone={book.available ? 'success' : book.reservedForPickup ? 'info' : 'warning'}
                  >
                    {book.available
                      ? `${availableCopies} of ${totalCopies} Available`
                      : book.reservedForPickup
                        ? 'Held at Circulation Desk'
                        : `0 of ${totalCopies} Available`}
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
                <dt className="detail-meta-term">Category / Genre</dt>
                <dd className="detail-meta-value">
                  {book.category ? book.category : <span className="text-muted">Uncategorized</span>}
                </dd>
              </div>
              <div className="detail-meta-row">
                <dt className="detail-meta-term">Shelf Location</dt>
                <dd className="detail-meta-value mono">
                  {book.shelfLocation ? book.shelfLocation : <span className="text-muted">Unassigned</span>}
                </dd>
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
            </dl>

            <section className="copy-inventory-section" aria-label="Physical copy inventory">
              <div className="copy-inventory-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                  <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
                    Physical Copies ({copies.length})
                  </h3>
                </div>
                {isStaff ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddCopy((prev) => !prev)}
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span>{showAddCopy ? 'Hide Form' : 'Add Copy'}</span>
                  </button>
                ) : null}
              </div>

              {isStaff && showAddCopy ? (
                <form className="copy-add-form" onSubmit={handleAddCopy}>
                  <input
                    type="text"
                    className="input-control mono"
                    placeholder="Barcode (auto if blank)"
                    aria-label="New copy barcode"
                    maxLength={64}
                    value={newCopyBarcode}
                    onChange={(e) => setNewCopyBarcode(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input-control"
                    placeholder={book.shelfLocation || 'Shelf (e.g. CS-204)'}
                    aria-label="New copy shelf location"
                    maxLength={60}
                    value={newCopyShelf}
                    onChange={(e) => setNewCopyShelf(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Condition note (optional)"
                    aria-label="New copy condition note"
                    maxLength={255}
                    value={newCopyNotes}
                    onChange={(e) => setNewCopyNotes(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={copyBusyId === 'add'}
                  >
                    {copyBusyId === 'add' ? 'Adding…' : 'Save Copy'}
                  </button>
                </form>
              ) : null}

              {copies.length === 0 ? (
                <p className="field-hint">No individual copy records registered yet.</p>
              ) : (
                <div className="copy-list">
                  {copies.map((copy) => {
                    const lockedStatus = copy.status === 'LOANED' || copy.status === 'ON_HOLD';
                    return (
                      <div key={copy.id} className="copy-item-row">
                        <div className="copy-item-meta">
                          <span className="catalog-id-badge mono">{copy.barcode}</span>
                          <StatusBadge tone={copyStatusTone(copy.status)}>{copy.status}</StatusBadge>
                          {copy.shelfLocation ? (
                            <span className="table-subline mono">Shelf {copy.shelfLocation}</span>
                          ) : null}
                          {copy.conditionNotes ? (
                            <span className="table-subline">· {copy.conditionNotes}</span>
                          ) : null}
                        </div>

                        {isStaff && !lockedStatus ? (
                          <div className="row-actions">
                            <select
                              className="select-control copy-status-select"
                              aria-label={`Condition status for ${copy.barcode}`}
                              value={copy.status}
                              disabled={copyBusyId === copy.id}
                              onChange={(e) =>
                                void handleCopyStatusChange(copy, e.target.value as BookCopyStatus)
                              }
                            >
                              <option value="AVAILABLE">AVAILABLE</option>
                              <option value="DAMAGED">DAMAGED</option>
                              <option value="LOST">LOST</option>
                            </select>
                            {copies.length > 1 ? (
                              <button
                                type="button"
                                className="btn btn-soft-danger btn-icon icon-square-btn"
                                disabled={copyBusyId === copy.id}
                                aria-label={`Delete copy ${copy.barcode}`}
                                title="Delete copy"
                                onClick={() => void handleDeleteCopy(copy)}
                              >
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
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
