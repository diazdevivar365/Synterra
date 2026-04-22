'use server';

import crypto from 'crypto';

import { and, eq, isNull } from 'drizzle-orm';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { signWorkspaceJwt } from '@synterra/auth';
import {
  ssoConnections,
  workspaces,
  users,
  baSessions,
  workspaceMembers,
  serviceRoleQuery,
} from '@synterra/db';

import { hasAquilaCredentials } from '@/lib/aquila-server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getProvisionQueue } from '@/lib/queue';

// ── Demo / bypass login ──────────────────────────────────────────────────────
// Provisions a demo user + reuses the first existing workspace (or bails if
// none exists) + mints both session cookies, then lands on the workspace
// dashboard. Enabled whenever DEV_AUTO_LOGIN_SECRET is set in env; never in
// production without that flag.
export async function demoLoginAction(formData: FormData): Promise<void> {
  if (!process.env['DEV_AUTO_LOGIN_SECRET']) {
    throw new Error('Demo login not enabled in this environment');
  }

  const wjwtSecret = process.env['WORKSPACE_JWT_SECRET'];
  if (!wjwtSecret) throw new Error('WORKSPACE_JWT_SECRET not set');

  const raw = formData.get('email');
  const email = (typeof raw === 'string' ? raw.trim() : '').toLowerCase() || 'demo@forgentic.io';
  if (!email.includes('@')) throw new Error('Invalid email');

  await serviceRoleQuery(db, (tx) =>
    tx
      .insert(users)
      .values({ email, name: email.split('@')[0], emailVerified: true })
      .onConflictDoNothing(),
  );
  const [user] = await serviceRoleQuery(db, (tx) =>
    tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
  );
  if (!user) throw new Error('User provisioning failed');

  const [ws] = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name })
      .from(workspaces)
      .where(isNull(workspaces.deletedAt))
      .limit(1),
  );
  if (!ws) {
    throw new Error(
      'No workspace exists yet — run provisioning or seed a workspace via /api/start/bootstrap',
    );
  }

  // Ensure the workspace has Aquila credentials provisioned — otherwise the
  // UI falls back to SEED data. Fire-and-forget BullMQ job; the provisioner
  // worker is idempotent so duplicate enqueues are safe.
  if (!(await hasAquilaCredentials(ws.id))) {
    try {
      await getProvisionQueue().add(
        'provision-workspace',
        { workspaceId: ws.id, workspaceSlug: ws.slug, workspaceName: ws.name },
        { jobId: `provision:${ws.id}`, removeOnComplete: true, removeOnFail: 100 },
      );
    } catch {
      // Queue unavailable — demo still continues with seed fallback.
    }
  }

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
  if (!member) throw new Error('Membership provisioning failed');

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await serviceRoleQuery(db, (tx) =>
    tx.insert(baSessions).values({
      id: crypto.randomUUID(),
      token,
      userId: user.id,
      expiresAt,
      ipAddress: '127.0.0.1',
      userAgent: 'Forgentic Demo',
    }),
  );

  const wjwt = await signWorkspaceJwt(
    { workspaceId: ws.id, userId: user.id, role: member.role, slug: ws.slug },
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
  jar.set('better-auth.session_token', token, opts);
  jar.set('synterra_wjwt', wjwt, opts);
  if (process.env.NODE_ENV === 'production') {
    jar.set('__Secure-better-auth.session_token', token, opts);
  }

  redirect(`/${ws.slug}`);
}

// Legacy bypass kept as alias for the new action name.
export const bypassLoginAction = demoLoginAction;

// ── Magic link ───────────────────────────────────────────────────────────────
export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  interface MagicLinkApi {
    signInMagicLink(opts: {
      body: { email: string; callbackURL: string };
      headers: Headers;
    }): Promise<void>;
  }
  await (auth.api as unknown as MagicLinkApi).signInMagicLink({
    body: { email, callbackURL: '/dashboard' },
    headers: await headers(),
  });

  redirect('/sign-in?sent=1');
}

// ── SSO ──────────────────────────────────────────────────────────────────────
export async function initiateSso(formData: FormData): Promise<void> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.includes('@')) {
    redirect('/sign-in?sso_error=invalid');
  }

  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) redirect('/sign-in?sso_error=invalid');

  const rows = await db
    .select({ slug: workspaces.slug })
    .from(ssoConnections)
    .innerJoin(workspaces, eq(workspaces.id, ssoConnections.workspaceId))
    .where(eq(ssoConnections.domain, domain))
    .limit(1);

  const slug = rows[0]?.slug;
  if (!slug) redirect('/sign-in?sso_error=not_found');

  redirect(`/api/auth/sso/initiate?workspace=${encodeURIComponent(slug)}`);
}
