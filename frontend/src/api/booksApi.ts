import { apiRequest } from '@/api/httpClient';
import type { Book, BookMetadataResponse, BookRequest } from '@/types/api';

export const booksApi = {
  listBooks(search = '', signal?: AbortSignal): Promise<Book[]> {
    const trimmed = search.trim();
    const query = trimmed ? `?search=${encodeURIComponent(trimmed)}` : '';
    return apiRequest<Book[]>(`/api/books${query}`, {
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
