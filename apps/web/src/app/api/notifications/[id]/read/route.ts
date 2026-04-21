import { and, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';

import { notificationDeliveries, serviceRoleQuery } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export const runtime = 'nodejs';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  await serviceRoleQuery(db, (tx) =>
    tx
      .update(notificationDeliveries)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationDeliveries.id, id),
          eq(notificationDeliveries.userId, ctx.userId),
          eq(notificationDeliveries.workspaceId, ctx.workspaceId),
        ),
      ),
  );

  return NextResponse.json({ ok: true });
}
