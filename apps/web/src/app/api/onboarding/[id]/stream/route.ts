import { eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { createDb, inflightBootstrap } from '@synterra/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createDb(process.env['DATABASE_URL'] ?? '');
const POLL_INTERVAL_MS = 2_000;
const MAX_POLLS = 90; // 90 × 2 s = 3 minutes

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      for (let poll = 0; poll < MAX_POLLS; poll++) {
        const [row] = await db
          .select()
          .from(inflightBootstrap)
          .where(eq(inflightBootstrap.id, id))
          .limit(1);

        if (!row) {
          send('error', { message: 'Session not found' });
          controller.close();
          return;
        }

        send('status', { status: row.status, previewData: row.previewData, error: row.error });

        if (row.status === 'preview_ready' || row.status === 'claimed' || row.status === 'failed') {
          controller.close();
          return;
        }

        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      send('error', { message: 'Timed out — please reload and try again.' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
