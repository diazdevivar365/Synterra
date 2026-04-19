'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  // auth.api is typed as base Auth which omits plugin endpoints; cast to any
  // to reach the magic-link plugin's signInMagicLink endpoint at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (auth.api as any).signInMagicLink({
    body: { email, callbackURL: '/dashboard' },
    headers: await headers(),
  });

  redirect('/sign-in?sent=1');
}
