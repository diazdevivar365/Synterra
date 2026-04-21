import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { notificationDeliveries, serviceRoleQuery } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await serviceRoleQuery(db, (tx) =>
    tx
      .select({
        id: notificationDeliveries.id,
        eventType: notificationDeliveries.eventType,
        channel: notificationDeliveries.channel,
        status: notificationDeliveries.status,
        payload: notificationDeliveries.payload,
        readAt: notificationDeliveries.readAt,
        createdAt: notificationDeliveries.createdAt,
      })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.workspaceId, ctx.workspaceId),
          eq(notificationDeliveries.userId, ctx.userId),
          eq(notificationDeliveries.channel, 'in_app'),
          eq(notificationDeliveries.status, 'delivered'),
        ),
      )
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(50),
  );

  const unreadCount = rows.filter((r) => r.readAt === null).length;

  return NextResponse.json({ notifications: rows, unreadCount });
}
