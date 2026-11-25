import { apiRequest } from '@/api/httpClient';
import type {
  Book,
  BookCopyRequest,
  BookCopyResponse,
  BookMetadataResponse,
  BookRequest,
} from '@/types/api';

export const booksApi = {
  listBooks(search = '', signal?: AbortSignal, category = ''): Promise<Book[]> {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (category.trim()) params.set('category', category.trim());
    const qs = params.toString();
    return apiRequest<Book[]>(`/api/books${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      auth: false,
      signal,
    });
  },

  listCategories(signal?: AbortSignal): Promise<string[]> {
    return apiRequest<string[]>('/api/books/categories', {
      method: 'GET',
      auth: false,
      signal,
    });
  },

  getBook(id: number, signal?: AbortSignal): Promise<Book> {
    return apiRequest<Book>(`/api/books/${id}`, {
      method: 'GET',
      auth: false,
      signal,
    });
  },

  listCopies(bookId: number, signal?: AbortSignal): Promise<BookCopyResponse[]> {
    return apiRequest<BookCopyResponse[]>(`/api/books/${bookId}/copies`, {
      method: 'GET',
      auth: false,
      signal,
    });
  },

  addCopy(bookId: number, request?: BookCopyRequest): Promise<BookCopyResponse> {
    return apiRequest<BookCopyResponse>(`/api/books/${bookId}/copies`, {
      method: 'POST',
      body: request ?? {},
    });
  },

  updateCopy(
    bookId: number,
    copyId: number,
    request: BookCopyRequest,
  ): Promise<BookCopyResponse> {
    return apiRequest<BookCopyResponse>(`/api/books/${bookId}/copies/${copyId}`, {
      method: 'PATCH',
      body: request,
    });
  },

  deleteCopy(bookId: number, copyId: number): Promise<void> {
    return apiRequest<void>(`/api/books/${bookId}/copies/${copyId}`, {
      method: 'DELETE',
    });
  },

  lookupIsbn(isbn: string, signal?: AbortSignal): Promise<BookMetadataResponse> {
    return apiRequest<BookMetadataResponse>(`/api/books/isbn/${encodeURIComponent(isbn)}`, {
      method: 'GET',
      auth: true,
      signal,
    });
  },

  createBook(request: BookRequest): Promise<Book> {
    return apiRequest<Book>('/api/books', {
      method: 'POST',
      body: request,
    });
  },

  updateBook(id: number, request: BookRequest): Promise<Book> {
    return apiRequest<Book>(`/api/books/${id}`, {
      method: 'PUT',
      body: request,
    });
  },

  deleteBook(id: number): Promise<void> {
    return apiRequest<void>(`/api/books/${id}`, {
      method: 'DELETE',
    });
  },
};
