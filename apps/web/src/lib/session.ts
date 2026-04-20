import 'server-only';

import { headers } from 'next/headers';

import { auth } from './auth';
import { ForbiddenError } from './errors';

export interface RequestSession {
  userId: string;
  email: string;
}

export async function getSessionOrThrow(): Promise<RequestSession> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ForbiddenError('Not authenticated');
  return {
    userId: session.user.id,
    email: session.user.email,
  };
}
