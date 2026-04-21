import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { verifyWorkspaceJwt } from '@synterra/auth';
import { auditLog, serviceRoleQuery, workspaces } from '@synterra/db';

import { db } from '@/lib/db';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get('synterra_wjwt')?.value;
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) throw new Error('WORKSPACE_JWT_SECRET not set');

  let payload: { workspaceId: string; userId: string; role: string };
  try {
    payload = await verifyWorkspaceJwt(token, secret);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (payload.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const raw = formData.get('confirmation');
  const confirmation = typeof raw === 'string' ? raw.trim() : '';

  const [ws] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, payload.workspaceId))
      .limit(1),
  );

  if (confirmation !== ws?.slug) {
    const origin = req.nextUrl.origin;
    return NextResponse.redirect(
      new URL(`/${ws?.slug ?? ''}/settings/data?error=confirm_mismatch`, origin),
    );
  }

  await serviceRoleQuery(db, async (tx) => {
    await tx
      .update(workspaces)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaces.id, payload.workspaceId));

    await tx.insert(auditLog).values({
      workspaceId: payload.workspaceId,
      actorKind: 'user',
      action: 'workspace.delete_requested',
      resourceType: 'workspace',
      resourceId: payload.workspaceId,
      after: { userId: payload.userId, note: 'Soft-deleted; data purged after 30 days' },
    });
  });

  const response = NextResponse.redirect(new URL('/workspaces', req.nextUrl.origin));
  response.cookies.delete('synterra_wjwt');
  return response;
}
