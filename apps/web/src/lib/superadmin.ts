import 'server-only';

import { eq } from 'drizzle-orm';

import { users } from '@synterra/db';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export interface SuperadminIdentity {
  userId: string;
  email: string;
  source: 'session';
}

export async function getSuperadminFromSession(
  reqHeaders: Headers,
): Promise<SuperadminIdentity | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session) return null;

  const [row] = await db
    .select({ isSuperadmin: users.isSuperadmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row?.isSuperadmin) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    source: 'session',
  };
}
