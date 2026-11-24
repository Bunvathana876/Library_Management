import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { booksApi } from '@/api/booksApi';
import { ErrorSummary, type SummaryErrorItem } from '@/components/ui/ErrorSummary';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useToast } from '@/context/ToastContext';
import type { Book } from '@/types/api';
import { ApiError, formatApiErrorMessage } from '@/utils/errors';
import { installFormValidationAria } from '@/utils/formValidation';

interface BookFormModalProps {
  open: boolean;
  editingBook: Book | null;
  onClose: () => void;
  onSaved: (book: Book) => void;
}

export function BookFormModal({ open, editingBook, onClose, onSaved }: BookFormModalProps) {
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publicationYear, setPublicationYear] = useState('2025');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [summaryErrors, setSummaryErrors] = useState<SummaryErrorItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(editingBook?.title ?? '');
    setAuthor(editingBook?.author ?? '');
    setPublicationYear(
      editingBook ? String(editingBook.publicationYear) : String(new Date().getFullYear()),
    );
    setErrorMsg(null);
    setFieldErrors({});
    setSummaryErrors([]);
    if (formRef.current) {
      return installFormValidationAria(formRef.current);
    }
  }, [open, editingBook]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const collected: SummaryErrorItem[] = [];
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
      const payload = {
        title: title.trim(),
        author: author.trim(),
        publicationYear: parsedYear,
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

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={editingBook ? `Edit Book #${editingBook.id}` : 'Add New Volume'}
      subtitle={
        editingBook
          ? 'Update title, author, or publication year in the library catalog'
          : 'Register a new book volume in the library catalog'
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
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) => setAuthor(e.target.value)}
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

          <div className="field">
            <label className="field-label" htmlFor="book-year">
              Publication year
            </label>
            <span id="book-year-hint" className="field-hint">
              Must be a positive whole year (e.g. 2024).
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
              onChange={(e) => setPublicationYear(e.target.value)}
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
