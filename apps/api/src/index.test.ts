/**
 * Synterra API — integration tests for the Hono app.
 *
 * These tests drive the app through `app.request(...)` so they run fully
 * offline — no network socket is bound.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

describe('Forgentic API — health endpoint', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  it('GET /v1/health returns 200 with the expected shape', async () => {
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; version: string; uptime: number };
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /v1/health sets Cache-Control: no-store', async () => {
    const res = await app.request('/v1/health');
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('must-revalidate');
  });

  it('echoes an inbound x-request-id header', async () => {
    const incoming = '11111111-2222-3333-4444-555555555555';
    const res = await app.request('/v1/health', {
      headers: { 'x-request-id': incoming },
    });
    expect(res.headers.get('x-request-id')).toBe(incoming);
  });

  it('generates an x-request-id when none is supplied', async () => {
    const res = await app.request('/v1/health');
    const generated = res.headers.get('x-request-id');
    expect(generated).toBeTruthy();
    // Must be a UUID v4-ish value of reasonable length.
    expect(generated!.length).toBeGreaterThanOrEqual(16);
  });

  it('injects strict-transport-security on responses', async () => {
    const res = await app.request('/v1/health');
    const hsts = res.headers.get('strict-transport-security');
    expect(hsts).toBeTruthy();
    expect(hsts).toContain('max-age=31536000');
  });
});

describe('Forgentic API — unknown routes', () => {
  it('returns 404 with JSON { error: "not_found" }', async () => {
    const app = buildApp();
    const res = await app.request('/this/route/does/not/exist');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: 'not_found' });
  });
});
