import type { LoggerLike } from '../lib/logger.js';
import type { Queue } from 'bullmq';
import type { NotificationType } from '@prisma/client';
import type { SystemConfigRepository } from '../repositories/system-config-repository.js';
import type {
  NotificationRepository,
  NotificationRow,
} from '../repositories/notification-repository.js';

const EMAIL_NOTIFICATIONS_ENABLED_KEY = 'EMAIL_NOTIFICATIONS_ENABLED';

export interface NotificationService {
  dispatch(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
  dispatchToAdmins(input: {
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
  listForUser(
    userId: string,
    options: { unreadOnly: boolean; limit: number; offset: number },
  ): Promise<{ notifications: NotificationRow[]; unread: number }>;
  markRead(id: string, userId: string): Promise<NotificationRow | null>;
  markAllRead(userId: string): Promise<number>;
}

/**
 * Creates in-app notifications and (when enabled) enqueues the corresponding
 * email job onto the BullMQ queue. Dispatch is best-effort: failures are logged
 * and never bubble up into the request flow that triggered them.
 */
export function createNotificationService(deps: {
  notificationRepository: NotificationRepository;
  systemConfigRepository: SystemConfigRepository;
  emailQueue: Queue;
  logger: LoggerLike;
}): NotificationService {
  const { notificationRepository, systemConfigRepository, emailQueue, logger } = deps;

  async function dispatch(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }) {
    try {
      await notificationRepository.create(input);
    } catch (error) {
      logger.error({ userId: input.userId, error }, 'failed to create notification');
    }

    try {
      const enabled = await systemConfigRepository.getBoolean(EMAIL_NOTIFICATIONS_ENABLED_KEY, true);
      if (!enabled) return;
      const to = await notificationRepository.getEmail(input.userId);
      if (!to) return;
      await emailQueue.add(
        'email-send',
        {
          to,
          type: input.type,
          title: input.title,
          body: input.body,
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000, jitter: 0.2 },
          removeOnComplete: { count: 1000 },
          removeOnFail: false,
        },
      );
    } catch (error) {
      logger.error({ userId: input.userId, error }, 'failed to enqueue notification email');
    }
  }

  async function dispatchToAdmins(input: {
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }) {
    const adminIds = await notificationRepository.listAdministratorIds();
    await Promise.all(
      adminIds.map((userId) => dispatch({ userId, ...input })),
    );
  }

  async function listForUser(
    userId: string,
    options: { unreadOnly: boolean; limit: number; offset: number },
  ) {
    const [notifications, unread] = await Promise.all([
      notificationRepository.listForUser(userId, options),
      notificationRepository.countUnread(userId),
    ]);
    return { notifications, unread };
  }

  async function markRead(id: string, userId: string) {
    const updated = await notificationRepository.markRead(id, userId);
    if (updated === 0) return null;
    return notificationRepository.findById(id, userId);
  }

  async function markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  }

  return { dispatch, dispatchToAdmins, listForUser, markRead, markAllRead };
}