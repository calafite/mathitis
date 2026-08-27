import type {
  AdminUser,
  ConfigPatch,
  DecisionBody,
  ModerationAction,
  SystemConfig,
} from '@mathitis/schemas';
import type { AdminRepository, AdminUserFilters } from '../repositories/admin-repository.js';
import type { AuditLogRepository, AuditLogFilters, AuditLogRow } from '../repositories/audit-log-repository.js';
import type { SystemConfigRepository } from '../repositories/system-config-repository.js';
import type { RequestService } from './request-service.js';
import {
  isSystemConfigKey,
  SYSTEM_CONFIG_DEFAULTS,
  SYSTEM_CONFIG_DEFINITIONS,
  validateConfigValue,
} from '../config/system-config.js';
import { ConflictError, NotFoundError } from '../errors.js';

export interface AdminService {
  getConfig(): Promise<SystemConfig>;
  updateConfig(actorId: string, ipAddress: string | null, patch: ConfigPatch): Promise<SystemConfig>;
  listUsers(filters: AdminUserFilters): Promise<{ users: AdminUser[]; total: number }>;
  setUserStatus(actorId: string, ipAddress: string | null, id: string, status: string): Promise<AdminUser>;
  anonymizeUser(actorId: string, ipAddress: string | null, id: string): Promise<{ user: AdminUser; lineagePreserved: boolean }>;
  moderateProfile(actorId: string, ipAddress: string | null, userId: string, action: ModerationAction): Promise<AdminUser>;
  listApprovals(status?: string): ReturnType<AdminRepository['listApprovals']>;
  listMentorshipRequests(status?: string): ReturnType<AdminRepository['listMentorshipRequests']>;
  listAuditLogs(
    filters: AuditLogFilters & { limit: number; offset: number },
  ): Promise<{ auditLogs: AuditLogRow[]; total: number }>;
  decideApproval(
    actorId: string,
    ipAddress: string | null,
    requestId: string,
    decision: DecisionBody['decision'],
    reason?: string,
  ): Promise<{ id: string; status: string; rejectionReason: string | null }>;
}

export function createAdminService(deps: {
  adminRepository: AdminRepository;
  systemConfigRepository: SystemConfigRepository;
  auditLogRepository: AuditLogRepository;
  requestService: RequestService;
  /** Invoked after anonymization with the affected handle (lineage cache). */
  onUserAnonymized?: (handle: string) => Promise<void>;
}): AdminService {
  const {
    adminRepository,
    systemConfigRepository,
    auditLogRepository,
    requestService,
    onUserAnonymized,
  } = deps;

  async function readConfig(): Promise<SystemConfig> {
    const stored = await systemConfigRepository.list();
    const config: Record<string, unknown> = { ...SYSTEM_CONFIG_DEFAULTS };
    for (const { key, value } of stored) {
      if (!isSystemConfigKey(key)) continue;
      const definition = SYSTEM_CONFIG_DEFINITIONS[key];
      if (definition.type === 'boolean' && typeof value === 'boolean') {
        config[key] = value;
      } else if (definition.type === 'number' && typeof value === 'number') {
        config[key] = value;
      }
    }
    return config as SystemConfig;
  }

  async function getConfig() {
    return readConfig();
  }

  async function updateConfig(actorId: string, ipAddress: string | null, patch: ConfigPatch) {
    const before = await readConfig();
    for (const [key, value] of Object.entries(patch)) {
      validateConfigValue(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      await systemConfigRepository.set(key, value);
      await auditLogRepository.create({
        actorId,
        action: 'config.update',
        targetEntity: 'system_config',
        targetId: key,
        details: {
          before: before[key as keyof SystemConfig],
          after: value,
        },
        ipAddress: ipAddress ?? undefined,
      });
    }
    return readConfig();
  }

  async function listUsers(filters: AdminUserFilters) {
    const [users, total] = await Promise.all([
      adminRepository.listUsers(filters),
      adminRepository.countUsers(filters),
    ]);
    return { users, total };
  }

  async function setUserStatus(actorId: string, ipAddress: string | null, id: string, status: string) {
    const existing = await adminRepository.findUserById(id);
    if (!existing) {
      throw new NotFoundError('Usuário não encontrado', 'USER_NOT_FOUND');
    }
    const user = await adminRepository.updateUserStatus(id, status as AdminUser['status']);
    await auditLogRepository.create({
      actorId,
      action: 'user.status.update',
      targetEntity: 'user',
      targetId: id,
      details: { before: existing.status, after: status },
      ipAddress: ipAddress ?? undefined,
    });
    return user;
  }

  async function anonymizeUser(actorId: string, ipAddress: string | null, id: string) {
    const existing = await adminRepository.findUserById(id);
    if (!existing) {
      throw new NotFoundError('Usuário não encontrado', 'USER_NOT_FOUND');
    }
    if (existing.deletedAt !== null) {
      throw new ConflictError('Este usuário já foi anonimizado', 'USER_ALREADY_ANONYMIZED');
    }
    const user = await adminRepository.anonymizeUser(id);
    await auditLogRepository.create({
      actorId,
      action: 'user.anonymize',
      targetEntity: 'user',
      targetId: id,
      details: {
        beforeHandle: existing.handle,
        afterHandle: user.handle,
        lineagePreserved: true,
      },
      ipAddress: ipAddress ?? undefined,
    });
    // The graph now contains the anonymized handle (user_<uuid>) — refresh.
    await onUserAnonymized?.(existing.handle);
    await onUserAnonymized?.(user.handle);
    return { user, lineagePreserved: true };
  }

  async function moderateProfile(
    actorId: string,
    ipAddress: string | null,
    userId: string,
    action: ModerationAction,
  ) {
    const existing = await adminRepository.findUserById(userId);
    if (!existing) {
      throw new NotFoundError('Usuário não encontrado', 'USER_NOT_FOUND');
    }
    await adminRepository.clearProfileField(userId, action);
    await auditLogRepository.create({
      actorId,
      action: `profile.moderate.${action}`,
      targetEntity: 'profile',
      targetId: userId,
      details: { action },
      ipAddress: ipAddress ?? undefined,
    });
    const updated = await adminRepository.findUserById(userId);
    if (!updated) {
      throw new NotFoundError('Usuário não encontrado', 'USER_NOT_FOUND');
    }
    return updated;
  }

  async function listApprovals(status?: string) {
    return adminRepository.listApprovals(status ?? 'pending_admin_approval');
  }

  async function listMentorshipRequests(status?: string) {
    return adminRepository.listMentorshipRequests(status);
  }

  async function listAuditLogs(
    filters: AuditLogFilters & { limit: number; offset: number },
  ) {
    const { limit, offset, ...whereFilters } = filters;
    const [auditLogs, total] = await Promise.all([
      auditLogRepository.list({ ...whereFilters, limit, offset }),
      auditLogRepository.count(whereFilters),
    ]);
    return { auditLogs, total };
  }

  async function decideApproval(
    actorId: string,
    ipAddress: string | null,
    requestId: string,
    decision: DecisionBody['decision'],
    reason?: string,
  ) {
    const result =
      decision === 'approve'
        ? await requestService.approveAdmin(actorId, requestId)
        : await requestService.denyAdmin(actorId, requestId, reason);

    await auditLogRepository.create({
      actorId,
      action: `approval.${decision}`,
      targetEntity: 'mentorship_request',
      targetId: requestId,
      details: { decision, reason: reason ?? null },
      ipAddress: ipAddress ?? undefined,
    });

    return {
      id: result.id,
      status: result.status,
      rejectionReason: result.rejectionReason,
    };
  }

  return {
    getConfig,
    updateConfig,
    listUsers,
    setUserStatus,
    anonymizeUser,
    moderateProfile,
    listApprovals,
    listMentorshipRequests,
    listAuditLogs,
    decideApproval,
  };
}