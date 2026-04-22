'use server';

import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { signWorkspaceJwt } from '@synterra/auth';
import { serviceRoleQuery, workspaces, workspaceMembers } from '@synterra/db';

import { db } from '@/lib/db';
import { getSuperadminFromSession } from '@/lib/superadmin';

// Super-admin jumps into any workspace by minting a workspace JWT for the target.
// Idempotently ensures the admin is a member (role=owner) so workspace-scoped
// queries succeed even on workspaces they never explicitly joined.
export async function impersonateWorkspaceAction(formData: FormData): Promise<void> {
  const h = await headers();
  const admin = await getSuperadminFromSession(h);
  if (!admin) throw new Error('Forbidden');

  const workspaceId = formData.get('workspaceId');
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('workspaceId required');
  }

  const wjwtSecret = process.env['WORKSPACE_JWT_SECRET'];
  if (!wjwtSecret) throw new Error('WORKSPACE_JWT_SECRET not set');

  const [ws] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ id: workspaces.id, slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1),
  );
  if (!ws) throw new Error('Workspace not found');

  await serviceRoleQuery(db, (tx) =>
    tx
      .insert(workspaceMembers)
      .values({ workspaceId: ws.id, userId: admin.userId, role: 'owner' })
      .onConflictDoNothing(),
  );

  const wjwt = await signWorkspaceJwt(
    { workspaceId: ws.id, userId: admin.userId, role: 'owner', slug: ws.slug },
    wjwtSecret,
    { expiresIn: '8h' },
  );

  const jar = await cookies();
  const opts = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
  };
  jar.set('synterra_wjwt', wjwt, opts);
  if (process.env.NODE_ENV === 'production') {
    jar.set('__Secure-synterra_wjwt', wjwt, opts);
  }

  redirect(`/${ws.slug}`);
}
