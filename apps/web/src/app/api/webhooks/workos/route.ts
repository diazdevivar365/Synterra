import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { constructScimEvent, createWorkOSClient } from '@synterra/auth';
import { ssoConnections, users, workspaceMembers } from '@synterra/db';

import { db } from '@/lib/db';

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env['WORKOS_WEBHOOK_SECRET'];
  const apiKey = process.env['WORKOS_API_KEY'];
  if (!secret || !apiKey) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const sigHeader = req.headers.get('workos-signature') ?? '';
  const payload = await req.text();

  let event;
  try {
    const workos = createWorkOSClient(apiKey);
    event = await constructScimEvent(workos, payload, sigHeader, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  if (!event) {
    // Non-dsync event — acknowledge and ignore
    return NextResponse.json({ received: true });
  }

  const { data } = event;

  switch (event.event) {
    case 'dsync.user.created':
    case 'dsync.user.updated': {
      if (!data.email) break;

      const email = data.email.toLowerCase();
      const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || null;

      await db
        .insert(users)
        .values({ email, name, emailVerified: true })
        .onConflictDoUpdate({
          target: users.email,
          set: { name, updatedAt: new Date() },
        });

      if (event.event === 'dsync.user.updated' && data.state === 'inactive') {
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser) {
          const conn = await getConnectionByDirectory(data.directoryId);
          if (conn) {
            await db
              .update(workspaceMembers)
              .set({ isDisabled: true })
              .where(
                and(
                  eq(workspaceMembers.workspaceId, conn.workspaceId),
                  eq(workspaceMembers.userId, existingUser.id),
                ),
              );
          }
        }
      }
      break;
    }

    case 'dsync.user.deleted': {
      if (!data.email) break;
      const email = data.email.toLowerCase();
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        const conn = await getConnectionByDirectory(data.directoryId);
        if (conn) {
          await db
            .update(workspaceMembers)
            .set({ isDisabled: true })
            .where(
              and(
                eq(workspaceMembers.workspaceId, conn.workspaceId),
                eq(workspaceMembers.userId, existingUser.id),
              ),
            );
        }
      }
      break;
    }

    case 'dsync.group.user_added':
    case 'dsync.group.user_removed':
      break;
  }

  return NextResponse.json({ received: true });
}

async function getConnectionByDirectory(
  directoryId: string,
): Promise<{ workspaceId: string } | undefined> {
  const rows = await db
    .select({ workspaceId: ssoConnections.workspaceId })
    .from(ssoConnections)
    .where(eq(ssoConnections.workosDirectoryId, directoryId))
    .limit(1);
  return rows[0];
}
