// Health endpoint.
//
// This route MUST never be cached at any layer: orchestrators, uptime probes,
// and load balancers rely on it reflecting the live process state. We pin:
//   - `dynamic = 'force-dynamic'`  → opt out of the default static render
//   - `revalidate = 0`             → belt-and-suspenders for RSC prerender
//   - `Cache-Control: no-store …`  → prevents upstream/CDN reuse
//
// Returning `process.uptime()` also makes it trivial for probes to detect
// a crash-looping container (uptime keeps resetting near zero).
import { NextResponse } from 'next/server';

import { version } from '@/lib/version';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { status: 'ok', version, uptime: process.uptime() },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
