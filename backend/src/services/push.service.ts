/**
 * Web Push Service
 *
 * Manages VAPID configuration and sending push notifications
 * to subscribed users via the Web Push protocol.
 */

import webpush from 'web-push';
import prisma from '../config/database.js';
import { env } from '../config/env.js';

// Configure VAPID once on load
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

export function pushConfigured(): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return env.VAPID_PUBLIC_KEY;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

/** Save a push subscription for a user (upserts on endpoint). */
export async function saveSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

/** Remove a push subscription by endpoint. */
export async function removeSubscription(endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/** Send a push notification to a single user (all their subscriptions). */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushConfigured()) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;

  const data = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err: any) {
        // 410 Gone = subscription expired — clean it up
        if (err.statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        } else {
          console.warn('[Push] Failed to send notification:', err.message);
        }
      }
    })
  );
}

/** Broadcast to all subscribed users. */
export async function broadcastPush(payload: PushPayload): Promise<void> {
  if (!pushConfigured()) return;
  const subs = await prisma.pushSubscription.findMany();
  const data = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data
      ).catch((err: any) => {
        if (err.statusCode === 410) {
          prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
      })
    )
  );
}
