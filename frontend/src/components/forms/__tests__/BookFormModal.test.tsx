import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { booksApi } from '@/api/booksApi';
import { BookFormModal } from '@/components/forms/BookFormModal';
import { ToastProvider } from '@/context/ToastContext';
import type { Book, BookMetadataResponse } from '@/types/api';

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('BookFormModal Instant ISBN Auto-Fill', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

    if (typeof HTMLDialogElement !== 'undefined') {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.open = true;
      };
      HTMLDialogElement.prototype.close = function close() {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      };
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('auto-fills metadata and cover artwork on ISBN entry and submits the populated book', async () => {
    const metadata: BookMetadataResponse = {
      isbn: '9780132350884',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publicationYear: 2008,
      publisher: 'Prentice Hall',
      coverUrl: 'https://covers.openlibrary.org/b/id/15126503-L.jpg',
      source: 'Open Library',
    };
    const savedBook: Book = {
      id: 99,
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publicationYear: 2008,
      isbn: '9780132350884',
      publisher: 'Prentice Hall',
      coverUrl: 'https://covers.openlibrary.org/b/id/15126503-L.jpg',
      available: true,
    };

    const lookupSpy = vi.spyOn(booksApi, 'lookupIsbn').mockResolvedValue(metadata);
    const createSpy = vi.spyOn(booksApi, 'createBook').mockResolvedValue(savedBook);
    const onSaved = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <ToastProvider>
          <BookFormModal open={true} editingBook={null} onClose={onClose} onSaved={onSaved} />
        </ToastProvider>,
      );
    });

    const isbnInput = container.querySelector('#book-isbn') as HTMLInputElement;
    const titleInput = container.querySelector('#book-title') as HTMLInputElement;
    const authorInput = container.querySelector('#book-author') as HTMLInputElement;
    const yearInput = container.querySelector('#book-year') as HTMLInputElement;
    const publisherInput = container.querySelector('#book-publisher') as HTMLInputElement;
    const coverInput = container.querySelector('#book-cover-url') as HTMLInputElement;

    await act(async () => {
      setNativeInputValue(isbnInput, '978-0-13-235088-4');
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(lookupSpy).toHaveBeenCalledTimes(1);
    expect(lookupSpy).toHaveBeenCalledWith('9780132350884', expect.any(AbortSignal));

    expect(isbnInput.value).toBe('9780132350884');
    expect(titleInput.value).toBe('Clean Code');
    expect(authorInput.value).toBe('Robert C. Martin');
    expect(yearInput.value).toBe('2008');
    expect(publisherInput.value).toBe('Prentice Hall');
    expect(coverInput.value).toBe('https://covers.openlibrary.org/b/id/15126503-L.jpg');
    expect(container.textContent).toContain('Verified via Open Library');

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(createSpy).toHaveBeenCalledWith({
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publicationYear: 2008,
      isbn: '9780132350884',
      publisher: 'Prentice Hall',
      coverUrl: 'https://covers.openlibrary.org/b/id/15126503-L.jpg',
    });
    expect(onSaved).toHaveBeenCalledWith(savedBook);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps manual entry available when Open Library returns 404 not found', async () => {
    const { ApiError } = await import('@/utils/errors');
    vi.spyOn(booksApi, 'lookupIsbn').mockRejectedValue(
      new ApiError(404, 'No book metadata found for ISBN 9789999999998'),
    );

    await act(async () => {
      root.render(
        <ToastProvider>
          <BookFormModal open={true} editingBook={null} onClose={vi.fn()} onSaved={vi.fn()} />
        </ToastProvider>,
      );
    });

    const isbnInput = container.querySelector('#book-isbn') as HTMLInputElement;
    await act(async () => {
      setNativeInputValue(isbnInput, '9781449373320');
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(container.textContent).toContain('No record found for ISBN 9781449373320 on Open Library');
    const titleInput = container.querySelector('#book-title') as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });
});
