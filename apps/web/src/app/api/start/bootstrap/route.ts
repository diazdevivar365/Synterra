import { and, eq, gte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { createAquilaClient, SUPPORTED_CONTRACT_VERSION } from '@synterra/aquila-client';
import { inflightBootstrap } from '@synterra/db';

import { db } from '@/lib/db';

const RATE_LIMIT_PER_IP = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function normalizeUrl(raw: string): string | null {
  try {
    const withProtocol = raw.startsWith('http') ? raw : `https://${raw}`;
    const u = new URL(withProtocol);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawUrl =
    body !== null && typeof body === 'object' && 'url' in body && typeof body.url === 'string'
      ? body.url.trim()
      : null;

  if (!rawUrl) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const url = normalizeUrl(rawUrl);
  if (!url) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inflightBootstrap)
    .where(and(eq(inflightBootstrap.ip, ip), gte(inflightBootstrap.createdAt, windowStart)));

  const recentCount = recentRows[0]?.count ?? 0;
  if (recentCount >= RATE_LIMIT_PER_IP) {
    return NextResponse.json({ error: 'Too many requests — try again later' }, { status: 429 });
  }

  const sessionId = crypto.randomUUID();

  const [row] = await db
    .insert(inflightBootstrap)
    .values({ sessionId, url, ip, status: 'pending' })
    .returning({ sessionId: inflightBootstrap.sessionId });

  if (!row) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  const anonApiKey = process.env['AQUILA_ANON_API_KEY'];
  const anonOrgSlug = process.env['AQUILA_ANON_ORG_SLUG'] ?? 'synterra-anon';
  const baseUrl = process.env['AQUILA_BASE_URL'];

  if (anonApiKey && baseUrl) {
    try {
      const client = createAquilaClient({
        baseUrl,
        apiKey: anonApiKey,
        orgSlug: anonOrgSlug,
        contractVersion: SUPPORTED_CONTRACT_VERSION,
      });

      const run = await client.createResearchRun(anonOrgSlug, {
        query: url,
        metadata: { bootstrapSessionId: sessionId, depth: 'light' },
      });

      await db
        .update(inflightBootstrap)
        .set({ aquilaRunId: run.id, status: 'running' })
        .where(eq(inflightBootstrap.sessionId, sessionId));
    } catch (err) {
      console.error('[bootstrap] Aquila run failed:', err);
      await db
        .update(inflightBootstrap)
        .set({ status: 'running' })
        .where(eq(inflightBootstrap.sessionId, sessionId));
    }
  } else {
    await db
      .update(inflightBootstrap)
      .set({ status: 'running' })
      .where(eq(inflightBootstrap.sessionId, sessionId));
  }

  return NextResponse.json({ sessionId }, { status: 201 });
}
