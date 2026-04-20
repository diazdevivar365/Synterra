import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { signWorkspaceJwt } from '@synterra/auth';
import { inflightBootstrap, workspaceMembers, workspaces } from '@synterra/db';

import { createWorkspace } from '@/actions/workspace';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const WORKSPACE_COOKIE = 'synterra_wjwt';
const COOKIE_MAX_AGE = 8 * 60 * 60;

async function switchToWorkspace(userId: string, workspaceId: string): Promise<void> {
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
  if (!first) return;

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) return;

  const token = await signWorkspaceJwt(
    { workspaceId, userId, role: first.role, slug: first.slug },
    secret,
  );

  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

function workspaceNameFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const hostname = u.hostname.replace(/^www\./, '');
    const base = hostname.split('.')[0] ?? hostname;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'My Workspace';
  }
}

function slugFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const hostname = u.hostname.replace(/^www\./, '');
    const base = hostname.split('.')[0] ?? hostname;
    return (
      base
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 48) || 'workspace'
    );
  } catch {
    return 'workspace';
  }
}

function makeRedirect(req: NextRequest, path: string): NextResponse {
  const base =
    process.env['NEXT_PUBLIC_APP_URL'] ??
    `${req.nextUrl.protocol}//${req.headers.get('host') ?? req.nextUrl.host}`;
  return NextResponse.redirect(new URL(path, base));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sessionId = req.nextUrl.searchParams.get('session');
  if (!sessionId) return makeRedirect(req, '/start');

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    const next = encodeURIComponent(`/api/start/claim?session=${sessionId}`);
    return makeRedirect(req, `/sign-in?next=${next}`);
  }

  const [row] = await db
    .select()
    .from(inflightBootstrap)
    .where(eq(inflightBootstrap.sessionId, sessionId))
    .limit(1);

  if (!row || row.status === 'expired') return makeRedirect(req, '/start');

  if (row.status === 'claimed' && row.workspaceId) {
    await switchToWorkspace(session.user.id, row.workspaceId);
    return makeRedirect(req, '/dashboard');
  }

  const name = workspaceNameFromUrl(row.url);
  const slug = slugFromUrl(row.url);

  const result = await createWorkspace({ name, slug });

  let workspaceId: string;
  if (!result.ok) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const retry = await createWorkspace({ name, slug: `${slug}-${suffix}` });
    if (!retry.ok) return makeRedirect(req, '/workspaces');
    workspaceId = retry.data.workspaceId;
  } else {
    workspaceId = result.data.workspaceId;
  }

  await db
    .update(inflightBootstrap)
    .set({ userId: session.user.id, workspaceId, status: 'claimed' })
    .where(eq(inflightBootstrap.sessionId, sessionId));

  await switchToWorkspace(session.user.id, workspaceId);

  return makeRedirect(req, '/dashboard');
}
