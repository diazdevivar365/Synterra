'use server';

import { and, eq } from 'drizzle-orm';

import { notificationSubscriptions, serviceRoleQuery } from '@synterra/db';

import { db } from '@/lib/db';
import {
  type NotificationChannel,
  type NotificationEventType,
  type SubscriptionRow,
} from '@/lib/notifications';
import { getWorkspaceContext } from '@/lib/workspace-context';

export async function getSubscriptions(): Promise<SubscriptionRow[]> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return [];

  return serviceRoleQuery(db, (tx) =>
    tx
      .select({
        id: notificationSubscriptions.id,
        eventType: notificationSubscriptions.eventType,
        channel: notificationSubscriptions.channel,
        isEnabled: notificationSubscriptions.isEnabled,
      })
      .from(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.workspaceId, ctx.workspaceId),
          eq(notificationSubscriptions.userId, ctx.userId),
        ),
      ),
  );
}

export async function upsertSubscription(
  eventType: NotificationEventType,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<void> {
  const ctx = await getWorkspaceContext();
  if (!ctx) throw new Error('Not authenticated');

  await serviceRoleQuery(db, (tx) =>
    tx
      .insert(notificationSubscriptions)
      .values({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        eventType,
        channel,
        isEnabled: enabled,
      })
      .onConflictDoUpdate({
        target: [
          notificationSubscriptions.workspaceId,
          notificationSubscriptions.userId,
          notificationSubscriptions.channel,
          notificationSubscriptions.eventType,
        ],
        set: { isEnabled: enabled },
      }),
  );
}
