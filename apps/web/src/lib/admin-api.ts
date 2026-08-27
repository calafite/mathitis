import { apiFetch } from '@/lib/api';
import type {
  AdminMentorshipRequestsResponse,
  AdminUsersResponse,
  AdminUsersQuery,
  AnonymizeResponse,
  ApprovalsResponse,
  AuditLogsQuery,
  AuditLogsResponse,
  ConfigResponse,
  DecisionBody,
  ModerationBody,
  SystemConfig,
  UpdateUserStatusBody,
} from '@mathitis/schemas';

export const adminApi = {
  async getConfig(): Promise<ConfigResponse> {
    return apiFetch<ConfigResponse>('/admin/config');
  },

  async updateConfig(patch: Partial<SystemConfig>): Promise<ConfigResponse> {
    return apiFetch<ConfigResponse>('/admin/config', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async listUsers(query: AdminUsersQuery): Promise<AdminUsersResponse> {
    const params = new URLSearchParams();
    if (query.role) params.set('role', query.role);
    if (query.status) params.set('status', query.status);
    if (query.semester !== undefined) params.set('semester', String(query.semester));
    if (query.q) params.set('q', query.q);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    const qs = params.toString();
    return apiFetch<AdminUsersResponse>(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  async updateUserStatus(id: string, body: UpdateUserStatusBody) {
    return apiFetch<{ user: AdminUsersResponse['users'][number] }>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async anonymizeUser(id: string): Promise<AnonymizeResponse> {
    return apiFetch<AnonymizeResponse>(`/admin/users/${id}/anonymize`, { method: 'PATCH' });
  },

  async moderateProfile(id: string, body: ModerationBody) {
    return apiFetch<{ user: AdminUsersResponse['users'][number] }>(
      `/admin/users/${id}/moderation`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
  },

  async listApprovals(status?: string): Promise<ApprovalsResponse> {
    const qs = status ? `?status=${status}` : '';
    return apiFetch<ApprovalsResponse>(`/admin/approvals${qs}`);
  },

  async listMentorshipRequests(status?: string): Promise<AdminMentorshipRequestsResponse> {
    const qs = status ? `?status=${status}` : '';
    return apiFetch<AdminMentorshipRequestsResponse>(`/admin/requests${qs}`);
  },

  async decideApproval(id: string, body: DecisionBody) {
    return apiFetch<{ request: { id: string; status: string; rejectionReason: string | null } }>(
      `/admin/approvals/${id}/decide`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  async listAuditLogs(query: AuditLogsQuery): Promise<AuditLogsResponse> {
    const params = new URLSearchParams();
    if (query.action) params.set('action', query.action);
    if (query.actorId) params.set('actorId', query.actorId);
    if (query.targetEntity) params.set('targetEntity', query.targetEntity);
    if (query.from) params.set('from', query.from.toISOString());
    if (query.to) params.set('to', query.to.toISOString());
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    const qs = params.toString();
    return apiFetch<AuditLogsResponse>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
