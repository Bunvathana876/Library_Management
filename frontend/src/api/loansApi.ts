import { apiRequest } from '@/api/httpClient';
import type { BorrowRequest, LoanResponse } from '@/types/api';

export const loansApi = {
  borrowBook(request: BorrowRequest): Promise<LoanResponse> {
    return apiRequest<LoanResponse>('/api/loans', {
      method: 'POST',
      body: request,
    });
  },

  getActiveLoans(signal?: AbortSignal): Promise<LoanResponse[]> {
    return apiRequest<LoanResponse[]>('/api/loans/active', {
      method: 'GET',
      signal,
    });
  },

  getOverdueLoans(signal?: AbortSignal): Promise<LoanResponse[]> {
    return apiRequest<LoanResponse[]>('/api/loans/overdue', {
      method: 'GET',
      signal,
    });
  },

  getFineLoans(signal?: AbortSignal): Promise<LoanResponse[]> {
    return apiRequest<LoanResponse[]>('/api/loans/fines', {
      method: 'GET',
      signal,
    });
  },

  getLoanById(id: number, signal?: AbortSignal): Promise<LoanResponse> {
    return apiRequest<LoanResponse>(`/api/loans/${id}`, {
      method: 'GET',
      signal,
    });
  },

  returnBook(id: number): Promise<LoanResponse> {
    return apiRequest<LoanResponse>(`/api/loans/${id}/return`, {
      method: 'POST',
    });
  },

  renewLoan(id: number): Promise<LoanResponse> {
    return apiRequest<LoanResponse>(`/api/loans/${id}/renew`, {
      method: 'POST',
    });
  },

  payFine(id: number, note?: string): Promise<LoanResponse> {
    return apiRequest<LoanResponse>(`/api/loans/${id}/fine/pay`, {
      method: 'POST',
      body: { note: note?.trim() || null },
    });
  },

  waiveFine(id: number, note?: string): Promise<LoanResponse> {
    return apiRequest<LoanResponse>(`/api/loans/${id}/fine/waive`, {
      method: 'POST',
      body: { note: note?.trim() || null },
    });
  },
};
