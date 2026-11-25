import { apiRequest } from '@/api/httpClient';
import type { AccountResponse, CreateAccountRequest } from '@/types/api';

export const adminApi = {
  listAccounts(signal?: AbortSignal): Promise<AccountResponse[]> {
    return apiRequest<AccountResponse[]>('/api/admin/users', {
      method: 'GET',
      signal,
    });
  },

  createAccount(request: CreateAccountRequest): Promise<AccountResponse> {
    return apiRequest<AccountResponse>('/api/admin/users', {
      method: 'POST',
      body: request,
    });
  },
};

