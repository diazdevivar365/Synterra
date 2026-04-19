'use server';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ssoConnections, workspaces } from '@synterra/db';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  // auth.api omits plugin endpoints in its generated types; use a local
  // interface to reach the magic-link plugin surface without unsafe-any casts.
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
