import { apiRequest } from '@/api/httpClient';
import type { AccountResponse, CreateAccountRequest } from '@/types/api';

export const adminApi = {
  createAccount(request: CreateAccountRequest): Promise<AccountResponse> {
    return apiRequest<AccountResponse>('/api/admin/users', {
      method: 'POST',
      body: request,
    });
  },
};
