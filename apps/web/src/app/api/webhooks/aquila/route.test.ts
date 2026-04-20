import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/brand-changes', () => ({
  insertBrandChange: vi.fn(),
}));

import * as brandChanges from '@/lib/brand-changes';

import { POST } from './route';

const SECRET = 'test-secret-abc123';

function makeBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    event_type: 'positioning_change',
    workspace_id: '00000000-0000-0000-0000-000000000001',
    brand_id: 'brand-abc',
    severity: 'warning',
    title: 'MarketLeader moved up 5 positions',
    description: 'Organic search visibility increased 12% this week.',
    metadata: {},
    occurred_at: '2026-04-20T10:00:00Z',
    ...overrides,
  });
}

function sign(body: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

function makeRequest(body: string, signature: string | null): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature !== null) {
    headers['x-aquila-signature'] = signature;
  }
  return new Request('http://localhost/api/webhooks/aquila', {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/webhooks/aquila', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete process.env['AQUILA_WEBHOOK_SECRET'];
  });

  describe('HMAC validation — secret present', () => {
    it('accepts a request with a valid signature', async () => {
      process.env['AQUILA_WEBHOOK_SECRET'] = SECRET;
      const body = makeBody();
      const req = makeRequest(body, sign(body, SECRET));

      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json() as { ok: boolean };
      expect(json.ok).toBe(true);
    });

    it('rejects a request with an invalid signature (401)', async () => {
      process.env['AQUILA_WEBHOOK_SECRET'] = SECRET;
      const body = makeBody();
      const req = makeRequest(body, 'sha256=deadbeef');

      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it('rejects a request with no signature header (401)', async () => {
      process.env['AQUILA_WEBHOOK_SECRET'] = SECRET;
      const body = makeBody();
      const req = makeRequest(body, null);

      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it('rejects a signature with a tampered body (401)', async () => {
      process.env['AQUILA_WEBHOOK_SECRET'] = SECRET;
      const originalBody = makeBody();
      const tamperedBody = makeBody({ title: 'Injected title' });
      const req = makeRequest(tamperedBody, sign(originalBody, SECRET));

      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });

  describe('HMAC validation — secret absent (dev mode)', () => {
    it('accepts the request without validation when secret is not set', async () => {
      const body = makeBody();
      const req = makeRequest(body, null);

      const res = await POST(req);

      expect(res.status).toBe(200);
    });
  });

  describe('Payload validation', () => {
    it('returns 400 for a malformed JSON body', async () => {
      const req = makeRequest('not-json', null);

      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when required field event_type is missing', async () => {
      const body = JSON.stringify({
        workspace_id: '00000000-0000-0000-0000-000000000001',
        brand_id: 'brand-abc',
        severity: 'info',
        title: 'Test',
        occurred_at: '2026-04-20T10:00:00Z',
      });
      const req = makeRequest(body, null);

      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when required field workspace_id is missing', async () => {
      const body = JSON.stringify({
        event_type: 'positioning_change',
        brand_id: 'brand-abc',
        severity: 'info',
        title: 'Test',
        occurred_at: '2026-04-20T10:00:00Z',
      });
      const req = makeRequest(body, null);

      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  describe('DB insertion', () => {
    it('calls insertBrandChange with the correct fields on success', async () => {
      const mockInsert = vi.mocked(brandChanges.insertBrandChange);
      mockInsert.mockResolvedValueOnce({
        id: 'row-1',
        workspaceId: '00000000-0000-0000-0000-000000000001',
        brandId: 'brand-abc',
        eventType: 'positioning_change',
        severity: 'warning',
        title: 'MarketLeader moved up 5 positions',
        description: 'Organic search visibility increased 12% this week.',
        metadata: {},
        occurredAt: new Date('2026-04-20T10:00:00Z'),
        createdAt: new Date('2026-04-20T10:00:00Z'),
      });

      const body = makeBody();
      const req = makeRequest(body, null);

      await POST(req);

      expect(mockInsert).toHaveBeenCalledOnce();
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: '00000000-0000-0000-0000-000000000001',
          brandId: 'brand-abc',
          eventType: 'positioning_change',
          severity: 'warning',
          title: 'MarketLeader moved up 5 positions',
        }),
      );
    });

    it('returns 200 with ok:true after a successful insert', async () => {
      vi.mocked(brandChanges.insertBrandChange).mockResolvedValueOnce({
        id: 'row-2',
        workspaceId: '00000000-0000-0000-0000-000000000001',
        brandId: 'brand-abc',
        eventType: 'positioning_change',
        severity: 'info',
        title: 'Test',
        description: null,
        metadata: {},
        occurredAt: new Date('2026-04-20T10:00:00Z'),
        createdAt: new Date('2026-04-20T10:00:00Z'),
      });

      const body = makeBody();
      const req = makeRequest(body, null);

      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json() as { ok: boolean };
      expect(json.ok).toBe(true);
    });
  });
});
