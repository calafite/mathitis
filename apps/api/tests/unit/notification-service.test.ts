import { describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import { createNotificationService } from '../../src/services/notification-service.js';
import type { NotificationRepository } from '../../src/repositories/notification-repository.js';
import type { SystemConfigRepository } from '../../src/repositories/system-config-repository.js';
import type { LoggerLike } from '../../src/lib/logger.js';

function silentLogger(): LoggerLike {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

describe('notification service', () => {
  it('creates an in-app notification row on dispatch', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'n1' });
    const getEmail = vi.fn().mockResolvedValue('fresh@example.com');
    const getBoolean = vi.fn().mockResolvedValue(true);
    const add = vi.fn().mockResolvedValue({ id: 'job1' });
    const service = createNotificationService({
      notificationRepository: {
        create,
        getEmail,
        listAdministratorIds: vi.fn(),
      } as unknown as NotificationRepository,
      systemConfigRepository: { getBoolean } as unknown as SystemConfigRepository,
      emailQueue: { add } as unknown as Queue,
      logger: silentLogger(),
    });

    await service.dispatch({
      userId: 'u1',
      type: 'request_received',
      title: 'New request',
      body: 'Someone wants to be mentored',
      payload: { requestId: 'r1' },
    });

    expect(create).toHaveBeenCalledWith({
      userId: 'u1',
      type: 'request_received',
      title: 'New request',
      body: 'Someone wants to be mentored',
      payload: { requestId: 'r1' },
    });
    expect(add).toHaveBeenCalledWith(
      'email-send',
      {
        to: 'fresh@example.com',
        type: 'request_received',
        title: 'New request',
        body: 'Someone wants to be mentored',
      },
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000, jitter: 0.2 },
      }),
    );
  });

  it('skips email enqueue when email notifications are disabled', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'n1' });
    const getBoolean = vi.fn().mockResolvedValue(false);
    const add = vi.fn();
    const service = createNotificationService({
      notificationRepository: {
        create,
        getEmail: vi.fn(),
      } as unknown as NotificationRepository,
      systemConfigRepository: { getBoolean } as unknown as SystemConfigRepository,
      emailQueue: { add } as unknown as Queue,
      logger: silentLogger(),
    });

    await service.dispatch({
      userId: 'u1',
      type: 'request_received',
      title: 'New request',
      body: 'Body',
    });

    expect(create).toHaveBeenCalledOnce();
    expect(add).not.toHaveBeenCalled();
  });

  it('skips email enqueue when the recipient has no email address', async () => {
    const getEmail = vi.fn().mockResolvedValue(null);
    const getBoolean = vi.fn().mockResolvedValue(true);
    const add = vi.fn();
    const service = createNotificationService({
      notificationRepository: {
        create: vi.fn().mockResolvedValue({ id: 'n1' }),
        getEmail,
      } as unknown as NotificationRepository,
      systemConfigRepository: { getBoolean } as unknown as SystemConfigRepository,
      emailQueue: { add } as unknown as Queue,
      logger: silentLogger(),
    });

    await service.dispatch({
      userId: 'u1',
      type: 'request_received',
      title: 'New request',
      body: 'Body',
    });

    expect(add).not.toHaveBeenCalled();
  });

  it('still creates the notification row when email enqueue fails', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'n1' });
    const getBoolean = vi.fn().mockResolvedValue(true);
    const add = vi.fn().mockRejectedValue(new Error('redis down'));
    const service = createNotificationService({
      notificationRepository: {
        create,
        getEmail: vi.fn().mockResolvedValue('fresh@example.com'),
      } as unknown as NotificationRepository,
      systemConfigRepository: { getBoolean } as unknown as SystemConfigRepository,
      emailQueue: { add } as unknown as Queue,
      logger: silentLogger(),
    });

    await expect(
      service.dispatch({
        userId: 'u1',
        type: 'request_received',
        title: 'New request',
        body: 'Body',
      }),
    ).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
  });

  it('dispatches to every administrator', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'n1' });
    const listAdministratorIds = vi.fn().mockResolvedValue(['a1', 'a2']);
    const getBoolean = vi.fn().mockResolvedValue(false);
    const service = createNotificationService({
      notificationRepository: {
        create,
        listAdministratorIds,
        getEmail: vi.fn(),
      } as unknown as NotificationRepository,
      systemConfigRepository: { getBoolean } as unknown as SystemConfigRepository,
      emailQueue: { add: vi.fn() } as unknown as Queue,
      logger: silentLogger(),
    });

    await service.dispatchToAdmins({
      type: 'approval_required',
      title: 'Approval needed',
      body: 'A request needs review',
    });

    expect(listAdministratorIds).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'a1', type: 'approval_required' }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'a2', type: 'approval_required' }),
    );
  });
});
