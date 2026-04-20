import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { createAquilaClient, SUPPORTED_CONTRACT_VERSION } from '@synterra/aquila-client';
import { inflightBootstrap } from '@synterra/db';

import { db } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params;

  const [row] = await db
    .select()
    .from(inflightBootstrap)
    .where(eq(inflightBootstrap.sessionId, sessionId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (row.status === 'claimed') {
    return NextResponse.json({ status: 'claimed', url: row.url });
  }

  if (row.status === 'expired' || new Date() > row.expiresAt) {
    return NextResponse.json({ status: 'expired' }, { status: 410 });
  }

  // Poll Aquila for run completion if we have a run ID and no result yet.
  if (row.aquilaRunId && row.status === 'running' && !row.result) {
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

        const run = await client.getResearchRun(anonOrgSlug, row.aquilaRunId);

        if (run.status === 'succeeded' && run.result) {
          await db
            .update(inflightBootstrap)
            .set({ status: 'ready', result: run.result })
            .where(eq(inflightBootstrap.sessionId, sessionId));

          return NextResponse.json({ status: 'ready', url: row.url, result: run.result });
        }

        if (run.status === 'failed' || run.status === 'cancelled') {
          await db
            .update(inflightBootstrap)
            .set({ status: 'ready' })
            .where(eq(inflightBootstrap.sessionId, sessionId));
          return NextResponse.json({ status: 'ready', url: row.url });
        }
      } catch (err) {
        console.error('[status] Aquila poll failed:', err);
      }
    }
  }

  return NextResponse.json({
    status: row.status,
    url: row.url,
    result: row.result ?? null,
  });
}
