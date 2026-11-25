import { apiRequest } from '@/api/httpClient';
import type { CreateHoldRequest, HoldResponse, LoanResponse } from '@/types/api';

export const holdsApi = {
  placeHold(request: CreateHoldRequest): Promise<HoldResponse> {
    return apiRequest<HoldResponse>('/api/holds', {
      method: 'POST',
      body: request,
    });
  },

  getActiveHolds(signal?: AbortSignal): Promise<HoldResponse[]> {
    return apiRequest<HoldResponse[]>('/api/holds/active', {
      method: 'GET',
      signal,
    });
  },

  cancelHold(holdId: number): Promise<HoldResponse> {
    return apiRequest<HoldResponse>(`/api/holds/${holdId}/cancel`, {
      method: 'POST',
    });
  },

  fulfillHold(holdId: number): Promise<LoanResponse> {
    return apiRequest<LoanResponse>(`/api/holds/${holdId}/fulfill`, {
      method: 'POST',
    });
  },
};
