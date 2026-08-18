import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'request_received',
  'request_accepted',
  'request_rejected',
  'request_cancelled',
  'approval_required',
  'approval_decision',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unread: z.number(),
});
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

export const notificationParamsSchema = z.object({
  id: z.string().uuid('Notification id must be a valid UUID'),
});
export type NotificationParams = z.infer<typeof notificationParamsSchema>;

export const notificationReadResponseSchema = z.object({
  notification: notificationSchema,
});
export type NotificationReadResponse = z.infer<typeof notificationReadResponseSchema>;

export const notificationsReadAllResponseSchema = z.object({
  updated: z.number(),
});
export type NotificationsReadAllResponse = z.infer<typeof notificationsReadAllResponseSchema>;