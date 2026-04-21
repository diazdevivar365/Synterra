import { desc, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { verifyWorkspaceJwt } from '@synterra/auth';
import { brandChanges, serviceRoleQuery, workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('synterra_wjwt')?.value;
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) throw new Error('WORKSPACE_JWT_SECRET not set');

  let payload: { workspaceId: string; userId: string };
  try {
    payload = await verifyWorkspaceJwt(token, secret);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { workspaceId } = payload;

  const [ws, members, changes] = await Promise.all([
    serviceRoleQuery(db, (tx) =>
      tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    ).then((r) => r[0] ?? null),

    serviceRoleQuery(db, (tx) =>
      tx.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId)),
    ),

    serviceRoleQuery(db, (tx) =>
      tx
        .select()
        .from(brandChanges)
        .where(eq(brandChanges.workspaceId, workspaceId))
        .orderBy(desc(brandChanges.occurredAt))
        .limit(10_000),
    ),
  ]);

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      workspace: ws
        ? { id: ws.id, slug: ws.slug, name: ws.name, plan: ws.planId, created_at: ws.createdAt }
        : null,
      members: members.map((m) => ({ user_id: m.userId, role: m.role, joined_at: m.joinedAt })),
      brand_changes: changes.map((ch) => ({
        id: ch.id,
        brand_id: ch.brandId,
        event_type: ch.eventType,
        severity: ch.severity,
        title: ch.title,
        description: ch.description,
        occurred_at: ch.occurredAt,
      })),
    },
    null,
    2,
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="forgentic-export-${workspaceId}.json"`,
    },
  });
}
