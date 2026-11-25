import { apiRequest } from '@/api/httpClient';
import type {
  AccountResponse,
  CreateAccountRequest,
  ScheduledJobRunResponse,
} from '@/types/api';

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

  updateAccountStatus(id: number, enabled: boolean): Promise<AccountResponse> {
    return apiRequest<AccountResponse>(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: { enabled },
    });
  },

  updateAccountRole(id: number, role: 'LIBRARIAN' | 'MEMBER'): Promise<AccountResponse> {
    return apiRequest<AccountResponse>(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: { role },
    });
  },

  resetPassword(id: number, newPassword: string): Promise<void> {
    return apiRequest<void>(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: { newPassword },
    });
  },

  runReminderJobs(): Promise<ScheduledJobRunResponse> {
    return apiRequest<ScheduledJobRunResponse>('/api/admin/jobs/run-reminders', {
      method: 'POST',
    });
  },
};
