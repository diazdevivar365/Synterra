import { register } from '@/lib/metrics';

// prom-client requires the Node runtime (no edge). Next.js defaults to
// Node for route handlers but we pin explicitly so a future config change
// cannot silently move us to edge.
export const runtime = 'nodejs';

// No caching — Prometheus scrapes every 15s and needs fresh counters.
export const dynamic = 'force-dynamic';

/**
 * Prometheus scrape endpoint for the Synterra web app. Exposes default
 * process/node metrics + http_requests_* populated by middleware.ts.
 *
 * Expose via intra-VPC scraping only; there is no auth on this route.
 * Traefik / ALB should drop public access.
 */
export async function GET(): Promise<Response> {
  const body = await register.metrics();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': register.contentType,
      'Cache-Control': 'no-store',
    },
  });
}
