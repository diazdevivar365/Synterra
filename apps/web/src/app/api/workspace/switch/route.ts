import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { signWorkspaceJwt } from '@synterra/auth';
import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { ForbiddenError } from '@/lib/errors';
import { getSessionOrThrow } from '@/lib/session';
import { getWorkspaceContext } from '@/lib/workspace-context';

const WORKSPACE_COOKIE = 'synterra_wjwt';
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours

export async function POST(req: Request): Promise<NextResponse> {
  // Primary: better-auth session. Fallback: workspace JWT (already verified by
  // middleware, identity set via headers). The fallback covers the case where
  // duplicate BA cookies (prefixed + unprefixed) confuse better-auth's cookie
  // resolution — the wjwt is cryptographically verified upstream so it's safe
  // as an auth source for switching within the same user's workspaces.
  let userId: string | null = null;
  try {
    const session = await getSessionOrThrow();
    userId = session.userId;
  } catch (err) {
    if (!(err instanceof ForbiddenError)) throw err;
    const ctx = await getWorkspaceContext();
    if (ctx) {
      userId = ctx.userId;
    }
  }
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('workspaceId' in body) ||
    typeof (body as Record<string, unknown>)['workspaceId'] !== 'string'
  ) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const workspaceId = (body as { workspaceId: string }).workspaceId;

  const rows = await db
    .select({ role: workspaceMembers.role, slug: workspaces.slug })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.isDisabled, false),
      ),
    )
    .limit(1);

  const first = rows[0];
  if (!first) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { role, slug } = first;

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const token = await signWorkspaceJwt({ workspaceId, userId, role, slug }, secret);

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ workspaceId, slug });
}
