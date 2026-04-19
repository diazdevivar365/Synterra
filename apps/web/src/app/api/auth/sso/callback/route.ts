import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createWorkOSClient, exchangeSsoCode, signWorkspaceJwt } from '@synterra/auth';
import { baAccounts, baSessions, users, workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db.js';

const SESSION_COOKIE = 'better-auth.session_token';
const WORKSPACE_COOKIE = 'synterra_wjwt';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const WORKSPACE_MAX_AGE = 60 * 60 * 8;

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const workspaceSlug = searchParams.get('state');

  if (!code || !workspaceSlug) {
    return NextResponse.redirect(new URL('/sign-in?error=sso_failed', req.url));
  }

  const apiKey = process.env['WORKOS_API_KEY'];
  const clientId = process.env['WORKOS_CLIENT_ID'];
  const jwtSecret = process.env['WORKSPACE_JWT_SECRET'];
  if (!apiKey || !clientId || !jwtSecret) {
    return NextResponse.redirect(new URL('/sign-in?error=sso_failed', req.url));
  }

  let profile;
  try {
    const workos = createWorkOSClient(apiKey);
    profile = await exchangeSsoCode(workos, code, clientId);
  } catch {
    return NextResponse.redirect(new URL('/sign-in?error=sso_failed', req.url));
  }

  const email = profile.email.toLowerCase();

  // Upsert user by email
  const [user] = await db
    .insert(users)
    .values({
      email,
      emailVerified: true,
      name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { emailVerified: true, updatedAt: new Date() },
    })
    .returning({ id: users.id });

  if (!user) {
    return NextResponse.redirect(new URL('/sign-in?error=sso_failed', req.url));
  }

  // Upsert ba_account for WorkOS provider
  await db
    .insert(baAccounts)
    .values({
      id: `workos_${profile.id}`,
      accountId: profile.id,
      providerId: 'workos',
      userId: user.id,
    })
    .onConflictDoNothing();

  // Create better-auth session
  const sessionToken = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await db.insert(baSessions).values({
    id: sessionId,
    token: sessionToken,
    userId: user.id,
    expiresAt,
  });

  // Look up workspace membership for workspace JWT
  const wsRows = await db
    .select({
      workspaceId: workspaces.id,
      role: workspaceMembers.role,
      slug: workspaces.slug,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaces.slug, workspaceSlug),
        eq(workspaceMembers.userId, user.id),
        eq(workspaceMembers.isDisabled, false),
      ),
    )
    .limit(1);

  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';

  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  const ws = wsRows[0];
  if (ws) {
    const wjwt = await signWorkspaceJwt(
      { workspaceId: ws.workspaceId, userId: user.id, role: ws.role, slug: ws.slug },
      jwtSecret,
    );
    cookieStore.set(WORKSPACE_COOKIE, wjwt, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: WORKSPACE_MAX_AGE,
      path: '/',
    });
    return NextResponse.redirect(new URL(`/${workspaceSlug}/dashboard`, req.url));
  }

  return NextResponse.redirect(new URL('/workspaces', req.url));
}
