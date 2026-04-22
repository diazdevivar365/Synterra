import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { signWorkspaceJwt } from '@synterra/auth';
import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { ForbiddenError } from '@/lib/errors';
import { getSessionOrThrow } from '@/lib/session';

const WORKSPACE_COOKIE = 'synterra_wjwt';
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours

export async function POST(req: Request): Promise<NextResponse> {
  let session;
  try {
    session = await getSessionOrThrow();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      const cookieHeader = req.headers.get('cookie') ?? '';
      const names = cookieHeader
        .split(';')
        .map((c) => c.trim().split('=')[0])
        .filter(Boolean);
      console.warn('[switch] 401 no session. cookieNames=', names);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
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
        eq(workspaceMembers.userId, session.userId),
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

  const token = await signWorkspaceJwt({ workspaceId, userId: session.userId, role, slug }, secret);

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
