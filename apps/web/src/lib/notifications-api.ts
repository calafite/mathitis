import { apiFetch } from '@/lib/api';
import type {
  Notification,
  NotificationReadResponse,
  NotificationsReadAllResponse,
  NotificationsResponse,
} from '@mathitis/schemas';

export interface NotificationListOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export const notificationsApi = {
  async list(options: NotificationListOptions = {}): Promise<NotificationsResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.unreadOnly) params.set('unreadOnly', 'true');
    const qs = params.toString();
    return apiFetch<NotificationsResponse>(`/notifications${qs ? `?${qs}` : ''}`);
  },

  async markRead(id: string): Promise<NotificationReadResponse> {
    return apiFetch<NotificationReadResponse>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  },

  async markAllRead(): Promise<NotificationsReadAllResponse> {
    return apiFetch<NotificationsReadAllResponse>('/notifications/read-all', {
      method: 'PATCH',
    });
  },
};

export type { Notification };