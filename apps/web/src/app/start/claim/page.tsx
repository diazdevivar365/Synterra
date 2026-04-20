import { and, eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

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

interface Props {
  searchParams: Promise<{ session?: string }>;
}

export default async function ClaimPage({ searchParams }: Props) {
  const { session: sessionId } = await searchParams;

  if (!sessionId) redirect('/start');

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(`/start/claim?session=${sessionId}`)}`);
  }

  const [row] = await db
    .select()
    .from(inflightBootstrap)
    .where(eq(inflightBootstrap.sessionId, sessionId))
    .limit(1);

  if (!row || row.status === 'expired') redirect('/start');

  // Already claimed — just switch to the existing workspace.
  if (row.status === 'claimed' && row.workspaceId) {
    await switchToWorkspace(session.user.id, row.workspaceId);
    redirect('/dashboard');
  }

  const name = workspaceNameFromUrl(row.url);
  const slug = slugFromUrl(row.url);

  const result = await createWorkspace({ name, slug });

  let workspaceId: string;
  if (!result.ok) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const retry = await createWorkspace({ name, slug: `${slug}-${suffix}` });
    if (!retry.ok) redirect('/workspaces');
    workspaceId = retry.data.workspaceId;
  } else {
    workspaceId = result.data.workspaceId;
  }

  await db
    .update(inflightBootstrap)
    .set({ userId: session.user.id, workspaceId, status: 'claimed' })
    .where(eq(inflightBootstrap.sessionId, sessionId));

  await switchToWorkspace(session.user.id, workspaceId);

  redirect('/dashboard');
}
