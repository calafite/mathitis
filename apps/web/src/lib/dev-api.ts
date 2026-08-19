import { apiFetch } from '@/lib/api';
import type {
  DevHealth,
  DevMetricsResponse,
  DevMailboxResponse,
  DevLinkResponse,
} from '@mathitis/schemas';

export const devApi = {
  async health(): Promise<DevHealth> {
    return apiFetch<DevHealth>('/dev/health');
  },

  async metrics(): Promise<DevMetricsResponse> {
    return apiFetch<DevMetricsResponse>('/dev/metrics');
  },

  async mailbox(options?: { to?: string; limit?: number }): Promise<DevMailboxResponse> {
    const params = new URLSearchParams();
    if (options?.to) params.set('to', options.to);
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.size > 0 ? `?${params.toString()}` : '';
    return apiFetch<DevMailboxResponse>(`/dev/mailbox${query}`);
  },

  async verificationLink(email: string): Promise<DevLinkResponse> {
    return apiFetch<DevLinkResponse>(`/dev/verification-link?email=${encodeURIComponent(email)}`);
  },

  async resetLink(email: string): Promise<DevLinkResponse> {
    return apiFetch<DevLinkResponse>(`/dev/reset-link?email=${encodeURIComponent(email)}`);
  },
};
