import { apiRequest } from '@/api/httpClient';
import type { NotificationListResponse, NotificationItem } from '@/types/api';

export const notificationsApi = {
  listNotifications(signal?: AbortSignal): Promise<NotificationListResponse> {
    return apiRequest<NotificationListResponse>('/api/me/notifications', {
      method: 'GET',
      signal,
    });
  },

  markRead(id: number): Promise<NotificationItem> {
    return apiRequest<NotificationItem>(`/api/me/notifications/${id}/read`, {
      method: 'POST',
    });
  },

  markAllRead(): Promise<{ updated: number }> {
    return apiRequest<{ updated: number }>('/api/me/notifications/read-all', {
      method: 'POST',
    });
  },
};
