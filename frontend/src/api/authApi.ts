import { apiRequest } from '@/api/httpClient';
import type { AuthUser, LoginRequest, LoginResponse } from '@/types/api';

export const authApi = {
  login(request: LoginRequest): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: request,
      auth: false,
      skipUnauthorizedHandler: true,
    });
  },

  getMe(signal?: AbortSignal): Promise<AuthUser> {
    return apiRequest<AuthUser>('/api/auth/me', {
      method: 'GET',
      auth: true,
      signal,
    });
  },
};
