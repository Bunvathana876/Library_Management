import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  ImageOff,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { booksApi } from '@/api/booksApi';
import { IsbnBarcodeScanner } from '@/components/forms/IsbnBarcodeScanner';
import { BookCoverImage } from '@/components/ui/BookCoverImage';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/context/ToastContext';
import type { Book, BookMetadataResponse } from '@/types/api';
import { ApiError, formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';
import {
  getAutoLookupCandidate,
  isSafeCoverUrl,
  isValidIsbn,
  normalizeIsbn,
} from '@/utils/isbn';

interface BookFormModalProps {
  open: boolean;
  editingBook: Book | null;
  onClose: () => void;
  onSaved: (book: Book) => void;
}

type LookupStatus = 'idle' | 'loading' | 'success' | 'not-found' | 'error';

interface AutofilledFlags {
  title: boolean;
  author: boolean;
  publicationYear: boolean;
  publisher: boolean;
  coverUrl: boolean;
}

interface AutoFilledValuesSnapshot {
  title: string;
  author: string;
  publicationYear: string;
  publisher: string;
  coverUrl: string;
}

const EMPTY_FLAGS: AutofilledFlags = {
  title: false,
  author: false,
  publicationYear: false,
  publisher: false,
  coverUrl: false,
};

export function BookFormModal({ open, editingBook, onClose, onSaved }: BookFormModalProps) {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const isbnInputRef = useRef<HTMLInputElement>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const lookupSeqRef = useRef(0);
  const lastLookedUpIsbnRef = useRef<string | null>(null);
  const skipNextDebounceIsbnRef = useRef<string | null>(null);
  const defaultYearRef = useRef(String(new Date().getFullYear()));
  const lastAutoFilledRef = useRef<AutoFilledValuesSnapshot | null>(null);

  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publicationYear, setPublicationYear] = useState(defaultYearRef.current);
  const [publisher, setPublisher] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [category, setCategory] = useState('');
  const [shelfLocation, setShelfLocation] = useState('');
  const [initialCopies, setInitialCopies] = useState('1');

  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupSource, setLookupSource] = useState<string | null>(null);
  const [pulledCoverUrl, setPulledCoverUrl] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [autofilled, setAutofilled] = useState<AutofilledFlags>(EMPTY_FLAGS);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  const stateRef = useRef({
    isbn,
    title,
    author,
    publicationYear,
    publisher,
    coverUrl,
    editingBook,
  });
  stateRef.current = {
    isbn,
    title,
    author,
    publicationYear,
    publisher,
    coverUrl,
    editingBook,
  };

  const cancelPendingLookup = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (lookupAbortRef.current) {
      lookupAbortRef.current.abort();
      lookupAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      cancelPendingLookup();
      setScannerOpen(false);
      return;
    }

    // Reset native :user-invalid / dirty constraint state across modal re-opens
    formRef.current?.reset();

    const currentYear = String(new Date().getFullYear());
    defaultYearRef.current = currentYear;
    lastAutoFilledRef.current = null;
    lastLookedUpIsbnRef.current = editingBook?.isbn ? normalizeIsbn(editingBook.isbn) : null;
    skipNextDebounceIsbnRef.current = null;

    setIsbn(editingBook?.isbn ?? '');
    setTitle(editingBook?.title ?? '');
    setAuthor(editingBook?.author ?? '');
    setPublicationYear(editingBook ? String(editingBook.publicationYear) : currentYear);
    setPublisher(editingBook?.publisher ?? '');
    setCoverUrl(editingBook?.coverUrl ?? '');
    setCategory(editingBook?.category ?? '');
    setShelfLocation(editingBook?.shelfLocation ?? '');
    setInitialCopies('1');

    setLookupStatus('idle');
    setLookupMessage('');
    setLookupSource(null);
    setPulledCoverUrl(editingBook?.coverUrl ?? null);
    setScannerOpen(false);
    setAutofilled(EMPTY_FLAGS);
    setErrorMsg(null);
    setFieldErrors({});
    setSummaryErrors([]);

    window.requestAnimationFrame(() => {
      isbnInputRef.current?.focus();
    });

    if (formRef.current) {
      return installFormValidationAria(formRef.current);
    }
  }, [open, editingBook, cancelPendingLookup]);

  useEffect(() => {
    return () => {
      cancelPendingLookup();
    };
  }, [cancelPendingLookup]);

  const applyLookupMetadata = useCallback(
    (data: BookMetadataResponse, forceOverwrite: boolean) => {
      const current = stateRef.current;
      const previousAuto = lastAutoFilledRef.current;
      const nextFlags: AutofilledFlags = { ...EMPTY_FLAGS };
      const filledLabels: string[] = [];

      const shouldFill = (
        currentValue: string,
        previousAutoValue: string | undefined,
        isDefaultPlaceholder = false,
      ): boolean => {
        if (forceOverwrite) return true;
        const trimmed = currentValue.trim();
        if (trimmed.length === 0) return true;
        if (isDefaultPlaceholder) return true;
        if (previousAutoValue !== undefined && trimmed === previousAutoValue) return true;
        return false;
      };

      const nextIsbn = data.isbn || normalizeIsbn(current.isbn);
      if (nextIsbn) {
        setIsbn(nextIsbn);
        lastLookedUpIsbnRef.current = nextIsbn;
      }

      let nextTitle = current.title;
      if (data.title && shouldFill(current.title, previousAuto?.title)) {
        nextTitle = data.title;
        setTitle(data.title);
        nextFlags.title = true;
        filledLabels.push('title');
      }

      let nextAuthor = current.author;
      if (data.author && shouldFill(current.author, previousAuto?.author)) {
        nextAuthor = data.author;
        setAuthor(data.author);
        nextFlags.author = true;
        filledLabels.push('author');
      }

      let nextYear = current.publicationYear;
      if (
        data.publicationYear &&
        shouldFill(
          current.publicationYear,
          previousAuto?.publicationYear,
          !current.editingBook && current.publicationYear === defaultYearRef.current,
        )
      ) {
        nextYear = String(data.publicationYear);
        setPublicationYear(nextYear);
        nextFlags.publicationYear = true;
        filledLabels.push('year');
      }

      let nextPublisher = current.publisher;
      if (data.publisher && shouldFill(current.publisher, previousAuto?.publisher)) {
        nextPublisher = data.publisher;
        setPublisher(data.publisher);
        nextFlags.publisher = true;
        filledLabels.push('publisher');
      }

      const safeCover = isSafeCoverUrl(data.coverUrl) ?? '';
      setPulledCoverUrl(safeCover || null);
      let nextCoverUrl = current.coverUrl;
      if (shouldFill(current.coverUrl, previousAuto?.coverUrl)) {
        nextCoverUrl = safeCover;
        setCoverUrl(safeCover);
        nextFlags.coverUrl = Boolean(safeCover);
        if (safeCover) {
          filledLabels.push('cover');
        }
      }

      lastAutoFilledRef.current = {
        title: nextTitle,
        author: nextAuthor,
        publicationYear: nextYear,
        publisher: nextPublisher,
        coverUrl: nextCoverUrl,
      };
      setAutofilled(nextFlags);
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated.isbn;
        if (nextFlags.title) delete updated.title;
        if (nextFlags.author) delete updated.author;
        if (nextFlags.publicationYear) delete updated.publicationYear;
        if (nextFlags.publisher) delete updated.publisher;
        if (nextFlags.coverUrl) delete updated.coverUrl;
        return updated;
      });
      setLookupStatus('success');
      setLookupSource(data.source || 'Open Library');
      setLookupMessage(
        filledLabels.length > 0
          ? `Auto-filled ${filledLabels.join(', ')} from ${data.source || 'Open Library'}.`
          : `Verified ISBN ${nextIsbn} via ${data.source || 'Open Library'}.`,
      );
    },
    [],
  );

  const runLookup = useCallback(
    async (normalizedIsbn: string, options: { forceOverwrite: boolean }) => {
      cancelPendingLookup();
      const seq = ++lookupSeqRef.current;
      const controller = new AbortController();
      lookupAbortRef.current = controller;

      setLookupStatus('loading');
      setLookupSource(null);
      setLookupMessage(`Looking up ISBN ${normalizedIsbn} via Open Library…`);
      setFieldErrors((prev) => {
        if (!prev.isbn) return prev;
        const copy = { ...prev };
        delete copy.isbn;
        return copy;
      });

      try {
        const result = await booksApi.lookupIsbn(normalizedIsbn, controller.signal);
        if (controller.signal.aborted || seq !== lookupSeqRef.current) {
          return;
        }
        applyLookupMetadata(result, options.forceOverwrite);
      } catch (err) {
        if (controller.signal.aborted || seq !== lookupSeqRef.current) {
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setLookupStatus('not-found');
          setLookupMessage(
            `No record found for ISBN ${normalizedIsbn} on Open Library. You can enter the details manually below.`,
          );
          return;
        }
        setLookupStatus('error');
        setLookupMessage(formatApiErrorMessage(err));
      } finally {
        if (lookupAbortRef.current === controller) {
          lookupAbortRef.current = null;
        }
      }
    },
    [applyLookupMetadata, cancelPendingLookup],
  );

  const handleIsbnChange = (rawValue: string) => {
    setIsbn(rawValue);
    setFieldErrors((prev) => {
      if (!prev.isbn) return prev;
      const copy = { ...prev };
      delete copy.isbn;
      return copy;
    });

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const normalized = normalizeIsbn(rawValue);
    if (!normalized) {
      cancelPendingLookup();
      lastLookedUpIsbnRef.current = null;
      setLookupStatus('idle');
      setLookupMessage('');
      setLookupSource(null);
      return;
    }

    if (skipNextDebounceIsbnRef.current === normalized) {
      skipNextDebounceIsbnRef.current = null;
      return;
    }

    if (lookupStatus === 'not-found' || lookupStatus === 'error') {
      setLookupStatus('idle');
      setLookupMessage('');
    }

    const candidate = getAutoLookupCandidate(rawValue);
    if (!candidate) {
      if (lookupAbortRef.current) {
        lookupAbortRef.current.abort();
        lookupAbortRef.current = null;
      }
      if (lookupStatus === 'loading') {
        setLookupStatus('idle');
        setLookupMessage('');
      }
      return;
    }

    if (candidate.normalized === lastLookedUpIsbnRef.current && lookupStatus === 'success') {
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void runLookup(candidate.normalized, { forceOverwrite: !editingBook });
    }, candidate.delayMs);
  };

  const handleIsbnPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    const normalized = normalizeIsbn(pasted);
    if (isValidIsbn(normalized)) {
      skipNextDebounceIsbnRef.current = normalized;
      void runLookup(normalized, { forceOverwrite: !editingBook });
    }
  };

  const handleManualLookup = () => {
    const normalized = normalizeIsbn(isbn);
    if (!isValidIsbn(normalized)) {
      setFieldErrors((prev) => ({
        ...prev,
        isbn: 'Enter a valid 10- or 13-digit ISBN (e.g. 9780132350884).',
      }));
      setLookupStatus('error');
      setLookupMessage('Enter a valid 10- or 13-digit ISBN before looking up metadata.');
      isbnInputRef.current?.focus();
      return;
    }
    setIsbn(normalized);
    void runLookup(normalized, { forceOverwrite: true });
  };

  const handleIsbnKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleManualLookup();
    }
  };

  const handleDetectedBarcode = (detectedIsbn: string) => {
    setScannerOpen(false);
    skipNextDebounceIsbnRef.current = detectedIsbn;
    setIsbn(detectedIsbn);
    void runLookup(detectedIsbn, { forceOverwrite: true });
  };

  const handleClearIsbn = () => {
    cancelPendingLookup();
    lastLookedUpIsbnRef.current = null;
    skipNextDebounceIsbnRef.current = null;
    setIsbn('');
    setLookupStatus('idle');
    setLookupMessage('');
    setLookupSource(null);
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy.isbn;
      return copy;
    });
    isbnInputRef.current?.focus();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const collected: SummaryErrorItem[] = [];
    const customFieldErrors: Record<string, string> = {};

    const normalizedIsbn = normalizeIsbn(isbn);
    if (normalizedIsbn.length > 0 && !isValidIsbn(normalizedIsbn)) {
      const msg = 'ISBN must be a valid 10- or 13-digit ISBN.';
      customFieldErrors.isbn = msg;
      collected.push({ fieldId: 'book-isbn', label: 'ISBN', message: msg });
    }

    const trimmedCover = coverUrl.trim();
    if (trimmedCover.length > 0 && !isSafeCoverUrl(trimmedCover)) {
      const msg = 'Cover URL must start with https://, http://, or /.';
      customFieldErrors.coverUrl = msg;
      collected.push({ fieldId: 'book-cover-url', label: 'Cover URL', message: msg });
    }

    if (!form.checkValidity() || collected.length > 0) {
      const titleEl = form.elements.namedItem('title') as HTMLInputElement | null;
      const authorEl = form.elements.namedItem('author') as HTMLInputElement | null;
      const yearEl = form.elements.namedItem('publicationYear') as HTMLInputElement | null;
      if (titleEl && !titleEl.validity.valid) {
        collected.push({
          fieldId: 'book-title',
          label: 'Book title',
          message: 'Please enter a book title (1–200 characters).',
        });
      }
      if (authorEl && !authorEl.validity.valid) {
        collected.push({
          fieldId: 'book-author',
          label: 'Author',
          message: 'Please enter the author name (1–150 characters).',
        });
      }
      if (yearEl && !yearEl.validity.valid) {
        collected.push({
          fieldId: 'book-year',
          label: 'Publication year',
          message: 'Enter a valid positive publication year.',
        });
      }
      setFieldErrors(customFieldErrors);
      setSummaryErrors(collected);
      return;
    }

    const parsedYear = Number.parseInt(publicationYear, 10);
    if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
      setFieldErrors({ publicationYear: 'Publication year must be a positive integer.' });
      setSummaryErrors([
        {
          fieldId: 'book-year',
          label: 'Publication year',
          message: 'Publication year must be a positive integer.',
        },
      ]);
      return;
    }

    setSummaryErrors([]);
    setSubmitting(true);
    setErrorMsg(null);
    setFieldErrors({});

    try {
      const parsedCopies = Number.parseInt(initialCopies, 10);
      const trimmedCategory = category.trim();
      const trimmedShelf = shelfLocation.trim();
      const payload = {
        title: title.trim(),
        author: author.trim(),
        publicationYear: parsedYear,
        isbn: normalizedIsbn || null,
        publisher: publisher.trim() || null,
        coverUrl: isSafeCoverUrl(trimmedCover) ?? null,
        ...(trimmedCategory ? { category: trimmedCategory } : {}),
        ...(trimmedShelf ? { shelfLocation: trimmedShelf } : {}),
        ...(!editingBook && Number.isFinite(parsedCopies) && parsedCopies > 1
          ? { initialCopies: Math.min(50, Math.max(1, parsedCopies)) }
          : {}),
      };

      const saved = editingBook
        ? await booksApi.updateBook(editingBook.id, payload)
        : await booksApi.createBook(payload);

      onSaved(saved);
      onClose();
      notify({
        variant: 'success',
        title: editingBook ? 'Book updated' : 'Book added to catalog',
        message: `"${saved.title}" by ${saved.author} (${saved.publicationYear}).`,
      });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      }
      setErrorMsg(formatApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const previewBook: Book = {
    id: editingBook?.id ?? 1,
    title: title.trim() || 'Book Preview',
    author: author.trim() || 'Unknown Author',
    publicationYear: Number.parseInt(publicationYear, 10) || new Date().getFullYear(),
    isbn: normalizeIsbn(isbn) || null,
    publisher: publisher.trim() || null,
    coverUrl: isSafeCoverUrl(coverUrl) ?? null,
    available: editingBook?.available ?? true,
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editingBook ? `Edit Book #${editingBook.id}` : 'Add New Volume'}
      subtitle={
        editingBook
          ? 'Update book metadata, ISBN, publisher, or cover artwork in the catalog'
          : 'Scan or type an ISBN to auto-fill verified book details, or enter manually'
      }
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

          <section className="isbn-autofill-panel" aria-label="Instant ISBN auto-fill">
            <div className="isbn-panel-header">
              <div className="isbn-panel-title-wrap">
                <Barcode size={17} aria-hidden="true" className="isbn-panel-icon" />
                <div>
                  <label className="field-label" htmlFor="book-isbn">
                    Instant ISBN Auto-Fill
                  </label>
                  <span id="book-isbn-hint" className="field-hint">
                    Type, paste, or scan ISBN-10 / ISBN-13 (USB scanners &amp; camera supported).
                  </span>
                </div>
              </div>
              {lookupSource && lookupStatus === 'success' ? (
                <StatusBadge tone="success">Verified via {lookupSource}</StatusBadge>
              ) : null}
            </div>

            <div className="isbn-input-row">
              <div className="isbn-input-wrap">
                <input
                  ref={isbnInputRef}
                  id="book-isbn"
                  name="isbn"
                  type="text"
                  className="input-control mono"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoComplete="off"
                  enterKeyHint="search"
                  maxLength={20}
                  value={isbn}
                  onChange={(e) => handleIsbnChange(e.target.value)}
                  onPaste={handleIsbnPaste}
                  onKeyDown={handleIsbnKeyDown}
                  aria-describedby="book-isbn-hint"
                  data-error="book-isbn-error"
                  placeholder="9780132350884"
                />
                {isbn ? (
                  <button
                    type="button"
                    className="isbn-clear-btn"
                    onClick={handleClearIsbn}
                    aria-label="Clear ISBN"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleManualLookup}
                disabled={lookupStatus === 'loading'}
              >
                {lookupStatus === 'loading' ? (
                  <progress aria-label="Looking up ISBN" className="loading-spinner" />
                ) : (
                  <Search size={15} aria-hidden="true" />
                )}
                <span>{lookupStatus === 'loading' ? 'Looking up…' : 'Look Up'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-expanded={scannerOpen}
                aria-controls="isbn-scanner-panel"
                onClick={() => setScannerOpen((prev) => !prev)}
              >
                <Camera size={15} aria-hidden="true" />
                <span>{scannerOpen ? 'Hide Camera' : 'Scan'}</span>
              </button>
            </div>

            <div
              id="book-isbn-error"
              className="field-error"
              data-visible={fieldErrors.isbn ? 'true' : undefined}
            >
              {fieldErrors.isbn || 'ISBN must be a valid 10- or 13-digit ISBN.'}
            </div>

            <IsbnBarcodeScanner
              open={scannerOpen}
              onDetected={handleDetectedBarcode}
              onClose={() => setScannerOpen(false)}
            />

            <div className="isbn-status-live" role="status" aria-live="polite">
              {lookupStatus === 'loading' ? (
                <div className="isbn-status-row isbn-status-loading">
                  <progress aria-label="Fetching book metadata" className="loading-spinner" />
                  <span>{lookupMessage}</span>
                </div>
              ) : null}

              {lookupStatus === 'not-found' ? (
                <div className="alert alert-warning">
                  <AlertCircle size={17} aria-hidden="true" className="alert-icon" />
                  <span>{lookupMessage}</span>
                </div>
              ) : null}

              {lookupStatus === 'error' ? (
                <div className="alert alert-danger">
                  <AlertCircle size={17} aria-hidden="true" className="alert-icon" />
                  <span>{lookupMessage}</span>
                </div>
              ) : null}

              {lookupStatus === 'success' ? (
                <div className="isbn-preview-card">
                  <div className="isbn-preview-thumb" aria-hidden="true">
                    <BookCoverImage
                      book={previewBook}
                      width={56}
                      height={76}
                      className="isbn-preview-cover-img"
                    />
                  </div>
                  <div className="isbn-preview-meta">
                    <div className="isbn-preview-heading">
                      <CheckCircle2 size={15} aria-hidden="true" className="isbn-preview-check" />
                      <span className="isbn-preview-title">{previewBook.title}</span>
                    </div>
                    <p className="isbn-preview-sub">
                      {previewBook.author} · {previewBook.publicationYear}
                      {previewBook.publisher ? ` · ${previewBook.publisher}` : ''}
                    </p>
                    <p className="isbn-preview-caption">{lookupMessage}</p>
                  </div>
                  <div className="isbn-preview-actions">
                    {pulledCoverUrl ? (
                      coverUrl.trim() ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setCoverUrl('');
                            setAutofilled((prev) => ({ ...prev, coverUrl: false }));
                          }}
                        >
                          <ImageOff size={14} aria-hidden="true" />
                          <span>Remove cover</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setCoverUrl(pulledCoverUrl);
                            setAutofilled((prev) => ({ ...prev, coverUrl: true }));
                          }}
                        >
                          <RotateCcw size={14} aria-hidden="true" />
                          <span>Restore cover</span>
                        </button>
                      )
                    ) : (
                      <span className="badge badge-neutral">Using fallback cover</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <div className="field">
            <label className="field-label" htmlFor="book-title">
              Book title
            </label>
            <span id="book-title-hint" className="field-hint">
              Required, up to 200 characters.
            </span>
            <input
              id="book-title"
              name="title"
              type="text"
              className="input-control"
              required
              maxLength={200}
              value={title}
              data-autofilled={autofilled.title ? 'true' : undefined}
              onChange={(e) => {
                setTitle(e.target.value);
                if (autofilled.title) setAutofilled((prev) => ({ ...prev, title: false }));
              }}
              aria-describedby="book-title-hint"
              data-error="book-title-error"
              placeholder="Designing Data-Intensive Applications"
            />
            <div
              id="book-title-error"
              className="field-error"
              data-visible={fieldErrors.title ? 'true' : undefined}
            >
              {fieldErrors.title || 'Please enter a book title (1–200 characters).'}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="book-author">
              Author
            </label>
            <span id="book-author-hint" className="field-hint">
              Required, up to 150 characters.
            </span>
            <input
              id="book-author"
              name="author"
              type="text"
              className="input-control"
              required
              maxLength={150}
              value={author}
              data-autofilled={autofilled.author ? 'true' : undefined}
              onChange={(e) => {
                setAuthor(e.target.value);
                if (autofilled.author) setAutofilled((prev) => ({ ...prev, author: false }));
              }}
              aria-describedby="book-author-hint"
              data-error="book-author-error"
              placeholder="Martin Kleppmann"
            />
            <div
              id="book-author-error"
              className="field-error"
              data-visible={fieldErrors.author ? 'true' : undefined}
            >
              {fieldErrors.author || 'Please enter the author name (1–150 characters).'}
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field">
              <label className="field-label" htmlFor="book-year">
                Publication year
              </label>
              <span id="book-year-hint" className="field-hint">
                Positive whole year (e.g. 2017).
              </span>
              <input
                id="book-year"
                name="publicationYear"
                type="number"
                className="input-control"
                inputMode="numeric"
                required
                min={1}
                step={1}
                value={publicationYear}
                data-autofilled={autofilled.publicationYear ? 'true' : undefined}
                onChange={(e) => {
                  setPublicationYear(e.target.value);
                  if (autofilled.publicationYear) {
                    setAutofilled((prev) => ({ ...prev, publicationYear: false }));
                  }
                }}
                aria-describedby="book-year-hint"
                data-error="book-year-error"
              />
              <div
                id="book-year-error"
                className="field-error"
                data-visible={fieldErrors.publicationYear ? 'true' : undefined}
              >
                {fieldErrors.publicationYear || 'Enter a valid positive publication year.'}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="book-publisher">
                Publisher
              </label>
              <span id="book-publisher-hint" className="field-hint">
                Optional, auto-filled from ISBN lookup.
              </span>
              <input
                id="book-publisher"
                name="publisher"
                type="text"
                className="input-control"
                maxLength={150}
                value={publisher}
                data-autofilled={autofilled.publisher ? 'true' : undefined}
                onChange={(e) => {
                  setPublisher(e.target.value);
                  if (autofilled.publisher) {
                    setAutofilled((prev) => ({ ...prev, publisher: false }));
                  }
                }}
                aria-describedby="book-publisher-hint"
                data-error="book-publisher-error"
                placeholder="O'Reilly Media"
              />
              <div
                id="book-publisher-error"
                className="field-error"
                data-visible={fieldErrors.publisher ? 'true' : undefined}
              >
                {fieldErrors.publisher || 'Publisher must be 150 characters or fewer.'}
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field">
              <label className="field-label" htmlFor="book-category">
                Category / Genre
              </label>
              <span id="book-category-hint" className="field-hint">
                Optional shelf classification (up to 80 characters).
              </span>
              <input
                id="book-category"
                name="category"
                type="text"
                list="book-category-presets"
                className="input-control"
                maxLength={80}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-describedby="book-category-hint"
                placeholder="Computer Science"
              />
              <datalist id="book-category-presets">
                <option value="Computer Science" />
                <option value="Fiction" />
                <option value="Science & Math" />
                <option value="History" />
                <option value="Biography" />
                <option value="Business & Economics" />
                <option value="Philosophy" />
                <option value="Reference" />
              </datalist>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="book-shelf-location">
                Shelf Location
              </label>
              <span id="book-shelf-location-hint" className="field-hint">
                Aisle / bay code (e.g. CS-204).
              </span>
              <input
                id="book-shelf-location"
                name="shelfLocation"
                type="text"
                className="input-control mono"
                maxLength={60}
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                aria-describedby="book-shelf-location-hint"
                placeholder="CS-204"
              />
            </div>
          </div>

          {!editingBook ? (
            <div className="field">
              <label className="field-label" htmlFor="book-initial-copies">
                Initial Physical Copies
              </label>
              <span id="book-initial-copies-hint" className="field-hint">
                Number of scannable barcoded copies (`CPY-xxxx-01`…) created for this title (1–50).
              </span>
              <input
                id="book-initial-copies"
                name="initialCopies"
                type="number"
                className="input-control"
                inputMode="numeric"
                min={1}
                max={50}
                step={1}
                value={initialCopies}
                onChange={(e) => setInitialCopies(e.target.value)}
                aria-describedby="book-initial-copies-hint"
                style={{ maxWidth: '140px' }}
              />
            </div>
          ) : null}

          <details className="isbn-cover-disclosure">
            <summary>Cover artwork URL (optional)</summary>
            <div className="field isbn-cover-disclosure-body">
              <label className="field-label" htmlFor="book-cover-url">
                Cover image URL
              </label>
              <span id="book-cover-url-hint" className="field-hint">
                Automatically populated from Open Library when available. Leave blank to use the
                default library cover.
              </span>
              <input
                id="book-cover-url"
                name="coverUrl"
                type="url"
                className="input-control mono"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={500}
                value={coverUrl}
                data-autofilled={autofilled.coverUrl ? 'true' : undefined}
                onChange={(e) => {
                  setCoverUrl(e.target.value);
                  if (autofilled.coverUrl) {
                    setAutofilled((prev) => ({ ...prev, coverUrl: false }));
                  }
                }}
                aria-describedby="book-cover-url-hint"
                data-error="book-cover-url-error"
                placeholder="https://covers.openlibrary.org/b/id/15126503-L.jpg"
              />
              <div
                id="book-cover-url-error"
                className="field-error"
                data-visible={fieldErrors.coverUrl ? 'true' : undefined}
              >
                {fieldErrors.coverUrl || 'Cover URL must start with https://, http://, or /.'}
              </div>
            </div>
          </details>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : editingBook ? 'Save Changes' : 'Create Book'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
