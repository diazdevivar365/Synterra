import { eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { signWorkspaceJwt } from '@synterra/auth';
import { serviceRoleQuery, workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!process.env['DEV_AUTO_LOGIN_SECRET']) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) throw new Error('WORKSPACE_JWT_SECRET not set');

  const rows = await serviceRoleQuery(db, (tx) =>
    tx
      .select({
        workspaceId: workspaces.id,
        slug: workspaces.slug,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
      })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(isNull(workspaces.deletedAt))
      .limit(1),
  );

  if (!rows[0]) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 404 });
  }

  const { workspaceId, slug, userId, role } = rows[0];

  const wjwt = await signWorkspaceJwt({ workspaceId, userId, role, slug }, secret, {
    expiresIn: '8h',
  });

  const origin = req.nextUrl.origin;
  const res = NextResponse.redirect(new URL(`/${slug}/brands`, origin));

  res.cookies.set('better-auth.session_token', 'dev', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
  });

  res.cookies.set('synterra_wjwt', wjwt, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
  });

  return res;
}
