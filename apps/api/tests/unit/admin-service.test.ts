import { describe, expect, it, vi } from 'vitest';
import { createAdminService, type AdminService } from '../../src/services/admin-service.js';
import type { AdminRepository, AdminUserRow } from '../../src/repositories/admin-repository.js';
import type { SystemConfigRepository } from '../../src/repositories/system-config-repository.js';
import type { AuditLogRepository } from '../../src/repositories/audit-log-repository.js';
import type { RequestService } from '../../src/services/request-service.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/errors.js';

function createFakes() {
  const stored = new Map<string, unknown>();
  const audits: Array<Record<string, unknown>> = [];

  const systemConfigRepository: SystemConfigRepository = {
    async getConfig(key) {
      return stored.get(key);
    },
    async getBoolean(key, fallback) {
      const v = stored.get(key);
      return typeof v === 'boolean' ? v : fallback;
    },
    async getNumber(key, fallback) {
      const v = stored.get(key);
      return typeof v === 'number' ? v : fallback;
    },
    async list() {
      return [...stored.entries()].map(([key, value]) => ({ key, value }));
    },
    async set(key, value) {
      stored.set(key, value);
    },
  };

  const auditLogRepository: AuditLogRepository = {
    async create(input) {
      audits.push(input);
    },
    async list() {
      return [];
    },
    async count() {
      return 0;
    },
  };

  const users: AdminUserRow[] = [
    {
      id: 'user-1',
      handle: 'root',
      email: 'root@uni.edu',
      role: 'administrator',
      semester: 10,
      status: 'active',
      deletedAt: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      socialName: null,
    },
    {
      id: 'user-2',
      handle: 'fresh_one',
      email: 'fresh_one@uni.edu',
      role: 'freshman',
      semester: 2,
      status: 'active',
      deletedAt: null,
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
      socialName: 'Freshy',
    },
  ];

  const adminRepository: AdminRepository = {
    async listUsers() {
      return users;
    },
    async countUsers() {
      return users.length;
    },
    async findUserById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async updateUserStatus(id, status) {
      const user = users.find((u) => u.id === id)!;
      return { ...user, status };
    },
    async anonymizeUser(id) {
      const user = users.find((u) => u.id === id)!;
      return {
        ...user,
        handle: `user_deadbeef`,
        email: `user_deadbeef@anonymized.local`,
        status: 'deactivated',
        deletedAt: new Date(),
      };
    },
    async clearProfileField() {},
    async listApprovals() {
      return [];
    },
  };

  const requestService = {
    submit: async () => ({}),
    listIncoming: async () => [],
    listSent: async () => [],
    getForInspection: async () => ({}),
    accept: async () => ({}),
    reject: async () => ({}),
    cancel: async () => ({}),
    approveAdmin: async (_adminId: string, requestId: string) => ({
      id: requestId,
      status: 'accepted',
      rejectionReason: null,
    }),
    denyAdmin: async (_adminId: string, requestId: string, reason?: string) => ({
      id: requestId,
      status: 'rejected',
      rejectionReason: reason ?? null,
    }),
  };

  const service: AdminService = createAdminService({
    adminRepository,
    systemConfigRepository,
    auditLogRepository,
    requestService: requestService as unknown as RequestService,
  });

  return { service, stored, audits, adminRepository };
}

describe('AdminService', () => {
  it('returns defaults for an empty config store', async () => {
    const { service } = createFakes();
    const config = await service.getConfig();
    expect(config).toMatchObject({
      REQUIRE_ADMIN_REQUEST_APPROVAL: false,
      DISCOVERY_ACTIVE: true,
      MAX_FRESHMAN_REQUESTS: 3,
    });
  });

  it('applies stored overrides on top of defaults', async () => {
    const { service, stored } = createFakes();
    stored.set('MAX_SENIOR_MENTEES', 7);
    stored.set('REGISTRATION_ENABLED', false);
    const config = await service.getConfig();
    expect(config.MAX_SENIOR_MENTEES).toBe(7);
    expect(config.REGISTRATION_ENABLED).toBe(false);
    expect(config.MAX_FRESHMAN_REQUESTS).toBe(3);
  });

  it('updates config and audits each change with before/after', async () => {
    const { service, stored, audits } = createFakes();
    await service.updateConfig('user-1', '10.0.0.1', {
      DISCOVERY_ACTIVE: false,
      MAX_FRESHMAN_REQUESTS: 6,
    });

    expect(stored.get('DISCOVERY_ACTIVE')).toBe(false);
    expect(stored.get('MAX_FRESHMAN_REQUESTS')).toBe(6);
    expect(audits).toHaveLength(2);

    const discoveryAudit = audits.find((a) => a.targetId === 'DISCOVERY_ACTIVE');
    expect(discoveryAudit).toMatchObject({
      actorId: 'user-1',
      action: 'config.update',
      targetEntity: 'system_config',
      ipAddress: '10.0.0.1',
      details: { before: true, after: false },
    });
  });

  it('rejects invalid config values without writing anything', async () => {
    const { service, stored, audits } = createFakes();
    await expect(
      service.updateConfig('user-1', null, { MAX_FRESHMAN_REQUESTS: 1000 }),
    ).rejects.toThrow(ValidationError);
    expect(stored.size).toBe(0);
    expect(audits).toHaveLength(0);
  });

  it('throws NotFound for unknown users', async () => {
    const { service } = createFakes();
    await expect(service.setUserStatus('user-1', null, 'missing', 'active')).rejects.toThrow(
      NotFoundError,
    );
    await expect(service.anonymizeUser('user-1', null, 'missing')).rejects.toThrow(NotFoundError);
  });

  it('refuses to anonymize an already deleted user', async () => {
    const { service, adminRepository } = createFakes();
    vi.spyOn(adminRepository, 'findUserById').mockResolvedValue({
      id: 'user-1',
      handle: 'root',
      email: 'root@uni.edu',
      role: 'administrator',
      semester: 10,
      status: 'deactivated',
      deletedAt: new Date(),
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      socialName: null,
    });
    await expect(service.anonymizeUser('user-1', null, 'user-1')).rejects.toThrow(ConflictError);
  });

  it('anonymizes a user and records a lineage-preserving audit entry', async () => {
    const { service, audits } = createFakes();
    const result = await service.anonymizeUser('user-1', '10.0.0.2', 'user-2');
    expect(result.lineagePreserved).toBe(true);
    expect(result.user.handle).not.toBe('fresh_one');
    expect(result.user.email).toMatch(/@anonymized\.local$/);

    const audit = audits.find((a) => a.action === 'user.anonymize');
    expect(audit).toMatchObject({
      actorId: 'user-1',
      targetEntity: 'user',
      targetId: 'user-2',
      ipAddress: '10.0.0.2',
      details: { beforeHandle: 'fresh_one', lineagePreserved: true },
    });
  });

  it('decides approvals through the request service', async () => {
    const { service, audits } = createFakes();
    const approved = await service.decideApproval('user-1', null, 'req-1', 'approve');
    expect(approved.status).toBe('accepted');

    const denied = await service.decideApproval('user-1', null, 'req-2', 'deny', 'Not enough effort');
    expect(denied.status).toBe('rejected');
    expect(denied.rejectionReason).toBe('Not enough effort');

    expect(audits.map((a) => a.action)).toEqual(['approval.approve', 'approval.deny']);
  });
});