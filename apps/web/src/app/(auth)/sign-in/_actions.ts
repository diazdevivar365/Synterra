'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  await auth.api.signInMagicLink({
    body: { email, callbackURL: '/dashboard' },
    headers: await headers(),
  });

  redirect('/sign-in?sent=1');
}
