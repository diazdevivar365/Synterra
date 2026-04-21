import { type NextRequest, NextResponse } from 'next/server';

const BASE = process.env['AQUILA_BASE_URL'] ?? '';
const KEY = process.env['AQUILA_API_KEY'] ?? '';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function errorStream(message: string): NextResponse {
  return new NextResponse(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  if (!BASE || !KEY) return errorStream('intelligence engine not configured');

  const upstream = await fetch(`${BASE}/research/${encodeURIComponent(runId)}/stream`, {
    headers: { Authorization: `Bearer ${KEY}` },
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) return errorStream('upstream unavailable');

  return new NextResponse(upstream.body, { status: 200, headers: SSE_HEADERS });
}
