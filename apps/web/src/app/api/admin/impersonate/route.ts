import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { signWorkspaceJwt } from '@synterra/auth';
import { auditLog, serviceRoleQuery, workspaceMembers, workspaces } from '@synterra/db';

import { verifyCloudflareAccess } from '@/lib/cloudflare-access';
import { db } from '@/lib/db';

const WORKSPACE_COOKIE = 'synterra_wjwt';
const IMPERSONATING_COOKIE = 'synterra_admin_impersonating';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const identity = await verifyCloudflareAccess(req.headers);
  if (!identity) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const workspaceId = formData.get('workspaceId');
  const userId = formData.get('userId');
  const redirectTo = formData.get('redirectTo');

  if (
    typeof workspaceId !== 'string' ||
    typeof userId !== 'string' ||
    typeof redirectTo !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
  }

  const [membership] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.isDisabled, false),
        ),
      )
      .limit(1),
  );
  if (!membership) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [ws] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1),
  );
  if (!ws) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) return NextResponse.json({ error: 'config_error' }, { status: 500 });

  const token = await signWorkspaceJwt(
    { workspaceId, userId, role: membership.role, slug: ws.slug },
    secret,
    { expiresIn: '2h' },
  );

  await serviceRoleQuery(db, (tx) =>
    tx.insert(auditLog).values({
      workspaceId,
      actorKind: 'admin',
      action: 'admin.impersonate',
      resourceType: 'workspace',
      resourceId: workspaceId,
      after: { adminEmail: identity.email, targetUserId: userId },
    }),
  );

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 2,
  };

  const url = req.nextUrl.clone();
  url.pathname = redirectTo;
  const response = NextResponse.redirect(url);
  response.cookies.set(WORKSPACE_COOKIE, token, cookieOpts);
  response.cookies.set(IMPERSONATING_COOKIE, identity.email, { ...cookieOpts, httpOnly: false });

  return response;
}
