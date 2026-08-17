import { apiFetch } from '@/lib/api';
import type { MentorshipRequest, RequestResponse, RequestsResponse } from '@mathitis/schemas';

export type RequestInbox = 'incoming' | 'sent';

export interface RequestListOptions {
  inbox?: RequestInbox;
  status?: string;
}

export function buildIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const requestsApi = {
  async list(options: RequestListOptions = {}): Promise<RequestsResponse> {
    const params = new URLSearchParams();
    if (options.inbox) params.set('inbox', options.inbox);
    if (options.status) params.set('status', options.status);
    const qs = params.toString();
    return apiFetch<RequestsResponse>(`/requests${qs ? `?${qs}` : ''}`);
  },

  async get(id: string): Promise<RequestResponse> {
    return apiFetch<RequestResponse>(`/requests/${encodeURIComponent(id)}`);
  },

  async create(input: { seniorHandle: string; message: string }, idempotencyKey: string): Promise<RequestResponse> {
    return apiFetch<RequestResponse>('/requests', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    });
  },

  async accept(id: string, idempotencyKey: string): Promise<RequestResponse> {
    return apiFetch<RequestResponse>(`/requests/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
    });
  },

  async reject(id: string, reason?: string): Promise<RequestResponse> {
    return apiFetch<RequestResponse>(`/requests/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },

  async cancel(id: string): Promise<RequestResponse> {
    return apiFetch<RequestResponse>(`/requests/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  },

  async approveAdmin(id: string): Promise<RequestResponse> {
    return apiFetch<RequestResponse>(`/requests/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
  },

  async denyAdmin(id: string, reason?: string): Promise<RequestResponse> {
    return apiFetch<RequestResponse>(`/requests/${encodeURIComponent(id)}/deny`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },
};

export type { MentorshipRequest };