import { apiRequest } from '@/api/httpClient';
import type { HealthResponse } from '@/types/api';

export const healthApi = {
  getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    return apiRequest<HealthResponse>('/actuator/health', { auth: false, signal });
  },
};
