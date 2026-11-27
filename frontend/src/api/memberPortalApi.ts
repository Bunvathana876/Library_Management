import { apiRequest } from '@/api/httpClient';
import type { LoanResponse, MemberBookshelfResponse } from '@/types/api';

export const memberPortalApi = {
  borrowBook(bookId: number): Promise<LoanResponse> {
    return apiRequest<LoanResponse>('/api/me/loans', {
      method: 'POST',
      body: { bookId },
    });
  },

  getBookshelf(signal?: AbortSignal): Promise<MemberBookshelfResponse> {
    return apiRequest<MemberBookshelfResponse>('/api/me/bookshelf', {
      method: 'GET',
      signal,
    });
  },

  renewOwnLoan(loanId: number): Promise<LoanResponse> {
    return apiRequest<LoanResponse>(`/api/me/loans/${loanId}/renew`, {
      method: 'POST',
    });
  },
};
