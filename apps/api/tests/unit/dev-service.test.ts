import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDevService } from '../../src/services/dev-service.js';

function makePrisma() {
  return {
    $queryRaw: vi.fn().mockRejectedValue(new Error('skip')),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function harness(userRow?: Record<string, unknown>) {
  const prisma = makePrisma();
  const bumpSessionEpoch = vi.fn().mockResolvedValue(2);
  const service = createDevService({
    prisma: prisma as never,
    redis: { ping: vi.fn().mockResolvedValue('PONG') } as never,
    queue: {} as never,
    bumpSessionEpoch,
  });
  if (userRow) prisma.user.findFirst.mockResolvedValue(userRow);
  return { service, prisma, bumpSessionEpoch };
}

const student = {
  id: 'u-1',
  handle: 'grace',
  email: 'grace@cs.uni.edu',
  role: 'senior',
  semester: 7,
  createdAt: new Date('2026-01-01'),
};

describe('devService.promoteToAdmin', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness({ ...student, deletedAt: null });
    h.prisma.user.update.mockResolvedValue({ ...student, role: 'administrator' });
    h.prisma.user.findUnique.mockResolvedValue({
      id: student.id,
      handle: student.handle,
      email: student.email,
      role: 'administrator',
      semester: student.semester,
      createdAt: student.createdAt,
      profile: { socialName: null },
    });
  });

  it('updates the role, emits an audit log and bumps the session epoch', async () => {
    const admin = await h.service.promoteToAdmin('dev-1', '10.0.0.1', 'grace');

    expect(h.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { role: 'administrator' },
    });
    expect(h.bumpSessionEpoch).toHaveBeenCalledWith('u-1');
    expect(h.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'dev-1',
        action: 'developer.admin.promote',
        targetId: 'u-1',
        ipAddress: '10.0.0.1',
        details: { previousRole: 'senior' },
      }),
    });
    expect(admin.role).toBe('administrator');
  });

  it('rejects unknown users', async () => {
    const fresh = harness();
    await expect(fresh.service.promoteToAdmin('dev-1', '', 'ghost')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects users that already hold administrative privileges', async () => {
    const existing = harness({ ...student, role: 'administrator', deletedAt: null });
    await expect(existing.service.promoteToAdmin('dev-1', '', 'grace')).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('devService.revokeAdmin', () => {
  it('demotes by semester (>=5 to senior) and bumps the epoch', async () => {
    const h = harness();
    h.prisma.user.findUnique.mockResolvedValue({ ...student, deletedAt: null, role: 'administrator' });

    await h.service.revokeAdmin('dev-1', '10.0.0.2', 'u-1');

    expect(h.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { role: 'senior' },
    });
    expect(h.bumpSessionEpoch).toHaveBeenCalledWith('u-1');
    expect(h.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'developer.admin.demote' }),
    });
  });

  it('demotes freshmen-stage administrators (<5) to freshman', async () => {
    const h = harness();
    h.prisma.user.findUnique.mockResolvedValue({ ...student, deletedAt: null, semester: 2, role: 'administrator' });

    await h.service.revokeAdmin('dev-1', '', 'u-1');

    expect(h.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { role: 'freshman' },
    });
  });

  it('refuses to revoke non-administrators', async () => {
    const h = harness();
    h.prisma.user.findUnique.mockResolvedValue({ ...student, deletedAt: null, role: 'senior' });

    await expect(h.service.revokeAdmin('dev-1', '', 'u-1')).rejects.toMatchObject({
      status: 422,
    });
  });
});
