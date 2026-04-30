import prisma from '../config/database.js';
import { sendPushToUser } from './push.service.js';

export type NotificationType =
  | 'suggestion_approved'
  | 'suggestion_denied'
  | 'suggestion_pending'
  | 'household_invite'
  | 'general';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  sendPush?: boolean;
}

/** Create an in-app notification and optionally fire a push notification. */
export async function createNotification(input: CreateNotificationInput) {
  const notif = await prisma.inAppNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? undefined,
    },
  });

  // Optionally fire push notification
  if (input.sendPush !== false) {
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body ?? '',
      data: { type: input.type, notificationId: notif.id, ...(input.metadata ?? {}) },
    }).catch((err) => console.error('[Push] notification failed:', err));
  }

  return notif;
}

export async function getNotifications(userId: string, unreadOnly = false) {
  return prisma.inAppNotification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function countUnread(userId: string) {
  return prisma.inAppNotification.count({ where: { userId, isRead: false } });
}

export async function markRead(userId: string, ids: string[]) {
  return prisma.inAppNotification.updateMany({
    where: { userId, id: { in: ids } },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.inAppNotification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
