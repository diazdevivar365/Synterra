import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { inflightBootstrap } from '@synterra/db';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

interface MagicLinkApi {
  signInMagicLink(opts: {
    body: { email: string; callbackURL: string };
    headers: Headers;
  }): Promise<void>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, sessionId } =
    'email' in body &&
    'sessionId' in body &&
    typeof body.email === 'string' &&
    typeof body.sessionId === 'string'
      ? { email: body.email, sessionId: body.sessionId }
      : { email: null, sessionId: null };

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const [row] = await db
    .select({ id: inflightBootstrap.id, status: inflightBootstrap.status })
    .from(inflightBootstrap)
    .where(eq(inflightBootstrap.sessionId, sessionId))
    .limit(1);

  if (!row || row.status === 'claimed' || row.status === 'expired') {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }

  await db
    .update(inflightBootstrap)
    .set({ email })
    .where(eq(inflightBootstrap.sessionId, sessionId));

  const callbackURL = `/start/claim?session=${encodeURIComponent(sessionId)}`;

  try {
    await (auth.api as unknown as MagicLinkApi).signInMagicLink({
      body: { email, callbackURL },
      headers: req.headers,
    });
  } catch (err) {
    console.error('[magic-link] send failed:', err);
    return NextResponse.json({ error: 'Failed to send magic link' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
