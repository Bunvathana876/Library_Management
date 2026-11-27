import { useConfirmation } from '@/hooks/useConfirmation';
import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { formatCallNumber, formatCopyStatus } from '@/utils/formatting';

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
  const { confirm, confirmationDialog } = useConfirmation();
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
        message: `${copy.barcode} marked as ${formatCopyStatus(nextStatus).toLowerCase()}.`,
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
    if (!await confirm({
      title: 'Delete physical copy?',
      message: `Permanently remove copy ${copy.barcode} from the inventory?`,
      confirmLabel: 'Delete copy',
    })) return;
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
    <>
      {confirmationDialog}
      <ModalDialog
        open={bookId !== null}
        onClose={onClose}
        size="lg"
        title={book ? book.title : `Catalog Record #${bookId ?? ''}`}
        subtitle={book ? `${book.author} · ${book.publicationYear}` : 'Loading catalog record…'}
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
                    width={96}
                    height={144}
                    className="book-detail-cover-img"
                  />
                </div>
                <div className="book-detail-summary">
                  <div className="queue-row-top">
                    <span className="catalog-id-badge mono">{formatCallNumber(book.id)}</span>
                    {book.category ? <span className="badge badge-neutral">{book.category}</span> : null}
                  </div>
                  <div className="queue-row-top">
                    <StatusBadge
                      tone={book.available ? 'success' : book.reservedForPickup ? 'info' : 'warning'}
                    >
                      {book.available
                        ? `${availableCopies} of ${totalCopies} available`
                        : book.reservedForPickup
                          ? 'Held at circulation desk'
                          : `0 of ${totalCopies} available`}
                    </StatusBadge>
                    {(book.activeHoldCount ?? 0) > 0 ? (
                      <span className="badge badge-warning tabular-nums">
                        {book.activeHoldCount}{' '}
                        {book.activeHoldCount === 1 ? 'reservation' : 'reservations'}
                      </span>
                    ) : null}
                  </div>
                  <p className="field-hint">
                    Scan the QR code at the circulation desk to reference this title directly.
                  </p>
                </div>
                <QrCodeCanvas
                  value={book.isbn || formatCallNumber(book.id)}
                  size={76}
                  label={`Catalog QR for ${book.title}`}
                />
              </div>

              <dl className="detail-meta-list">
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
                  <dt className="detail-meta-term">Shelf Location</dt>
                  <dd className="detail-meta-value mono">
                    {book.shelfLocation ? book.shelfLocation : <span className="text-muted">Unassigned</span>}
                  </dd>
                </div>
                <div className="detail-meta-row">
                  <dt className="detail-meta-term">Category</dt>
                  <dd className="detail-meta-value">
                    {book.category ? book.category : <span className="text-muted">General collection</span>}
                  </dd>
                </div>
              </dl>

              <section className="copy-inventory-section" aria-label="Physical copy inventory">
                <div className="copy-inventory-header">
                  <h3 className="card-title">
                    Physical Copies ({copies.length})
                  </h3>
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
                            <StatusBadge tone={copyStatusTone(copy.status)}>
                              {formatCopyStatus(copy.status)}
                            </StatusBadge>
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
                                <option value="AVAILABLE">Available</option>
                                <option value="DAMAGED">Damaged</option>
                                <option value="LOST">Lost</option>
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
            book && (isStaff || book.available || (!book.available && isAuthenticated && onPlaceHold))
              ? 'modal-footer-split'
              : ''
          }`.trim()}
        >
          {book ? (
            <div className="row-actions">
              {!isStaff && (book.available || myActiveHolds.some((hold) => hold.bookId === book.id && hold.status === 'READY_FOR_PICKUP')) ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    onClose();
                    onBorrow(book);
                  }}
                >
                  <span>{isAuthenticated ? 'Borrow' : 'Sign In to Borrow'}</span>
                </button>
              ) : null}
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
                          : `In holds queue (#${existingHold.queuePosition})`}
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
    </>
  );
}
