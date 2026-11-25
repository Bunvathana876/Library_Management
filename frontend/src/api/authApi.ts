import { apiRequest } from '@/api/httpClient';
import type {
  AuthUser,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from '@/types/api';

export const authApi = {
  login(request: LoginRequest): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: request,
      auth: false,
      skipUnauthorizedHandler: true,
    });
  },

  register(request: RegisterRequest): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/api/auth/register', {
      method: 'POST',
      body: request,
      auth: false,
      skipUnauthorizedHandler: true,
    });
  },

  changePassword(request: ChangePasswordRequest): Promise<void> {
    return apiRequest<void>('/api/auth/change-password', {
      method: 'POST',
      body: request,
      auth: true,
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
