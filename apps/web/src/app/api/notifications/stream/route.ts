import IORedis from 'ioredis';
import { type NextRequest } from 'next/server';

import { getWorkspaceContext } from '@/lib/workspace-context';

export const runtime = 'nodejs';
// SSE connections must not be cached or buffered
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  const channel = `notif:user:${ctx.userId}`;
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) return new Response('REDIS_URL not set', { status: 500 });

  // Each SSE connection needs its own subscriber — ioredis subscriber mode
  // blocks the connection for all non-subscribe commands.
  const sub = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();

      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': ping\n\n'));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);

      void sub.subscribe(channel, (err) => {
        if (err) {
          clearInterval(ping);
          controller.error(err);
        }
      });

      sub.on('message', (_ch: string, message: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${message}\n\n`));
        } catch {
          // controller already closed
        }
      });

      req.signal.addEventListener('abort', () => {
        clearInterval(ping);
        void sub.unsubscribe(channel).finally(() => sub.quit());
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      void sub.unsubscribe(channel).finally(() => sub.quit());
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
