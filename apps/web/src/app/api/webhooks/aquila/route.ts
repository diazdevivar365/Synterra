import { createHmac, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { insertBrandChange, toSeverity } from '@/lib/brand-changes';

export const dynamic = 'force-dynamic';

interface AquilaWebhookPayload {
  event_type: string;
  workspace_id: string;
  brand_id: string;
  severity?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  occurred_at: string;
}

function isValidPayload(v: unknown): v is AquilaWebhookPayload {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p['event_type'] === 'string' &&
    typeof p['workspace_id'] === 'string' &&
    typeof p['brand_id'] === 'string' &&
    typeof p['title'] === 'string' &&
    typeof p['occurred_at'] === 'string'
  );
}

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  if (!header.startsWith('sha256=')) return false;
  const provided = Buffer.from(header.slice(7), 'hex');
  const hmac = createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = hmac.digest();
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  const secret = process.env['AQUILA_WEBHOOK_SECRET'];
  if (secret) {
    const sigHeader = request.headers.get('x-aquila-signature');
    if (!sigHeader) {
      return NextResponse.json({ error: 'Missing X-Aquila-Signature header' }, { status: 401 });
    }
    if (!verifySignature(rawBody, sigHeader, secret)) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json(
      { error: 'Missing required fields: event_type, workspace_id, brand_id, title, occurred_at' },
      { status: 400 },
    );
  }

  const occurredAt = new Date(payload.occurred_at);
  if (isNaN(occurredAt.getTime())) {
    return NextResponse.json(
      { error: 'occurred_at is not a valid ISO 8601 date' },
      { status: 400 },
    );
  }

  try {
    await insertBrandChange({
      workspaceId: payload.workspace_id,
      brandId: payload.brand_id,
      eventType: payload.event_type,
      severity: toSeverity(payload.severity),
      title: payload.title,
      description: payload.description ?? null,
      metadata: payload.metadata ?? {},
      occurredAt,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
