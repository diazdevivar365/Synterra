'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

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
