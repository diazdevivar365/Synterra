'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { signWorkspaceJwt } from '@synterra/auth';
import { baSessions, serviceRoleQuery, users, workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';

export async function devLogin(formData: FormData): Promise<void> {
  if (!process.env['DEV_AUTO_LOGIN_SECRET']) {
    throw new Error('Dev login not enabled');
  }

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) throw new Error('WORKSPACE_JWT_SECRET not set');

  const raw = formData.get('email');
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!email.includes('@')) throw new Error('Invalid email');

  // Upsert user by email
  await serviceRoleQuery(db, (tx) =>
    tx
      .insert(users)
      .values({ email, name: email.split('@')[0], emailVerified: true })
      .onConflictDoNothing(),
  );

  const [user] = await serviceRoleQuery(db, (tx) =>
    tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
  );
  if (!user) throw new Error('Failed to find/create user');

  // Find first non-deleted workspace
  const [ws] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ id: workspaces.id, slug: workspaces.slug })
      .from(workspaces)
      .where(isNull(workspaces.deletedAt))
      .limit(1),
  );
  if (!ws) throw new Error('No workspace found');

  // Ensure user is a member
  await serviceRoleQuery(db, (tx) =>
    tx
      .insert(workspaceMembers)
      .values({ workspaceId: ws.id, userId: user.id, role: 'owner' })
      .onConflictDoNothing(),
  );

  const [member] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws.id), eq(workspaceMembers.userId, user.id)))
      .limit(1),
  );
  if (!member) throw new Error('Failed to ensure membership');

  // Create real better-auth session
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await serviceRoleQuery(db, (tx) =>
    tx.insert(baSessions).values({ id: crypto.randomUUID(), token, userId: user.id, expiresAt }),
  );

  const wjwt = await signWorkspaceJwt(
    { workspaceId: ws.id, userId: user.id, role: member.role, slug: ws.slug },
    secret,
    { expiresIn: '8h' },
  );

  const jar = await cookies();
  const opts = { httpOnly: true, path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 8 };
  jar.set('better-auth.session_token', token, opts);
  jar.set('synterra_wjwt', wjwt, opts);

  redirect(`/${ws.slug}/brands`);
}
