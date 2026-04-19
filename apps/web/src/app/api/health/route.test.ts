import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /api/health', () => {
  it('returns 200 with ok status and a JSON body matching the contract', async () => {
    const res = GET();

    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: unknown; version: unknown; uptime: unknown };

    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime as number).toBeGreaterThanOrEqual(0);
  });

  it('disables caching via Cache-Control: no-store', () => {
    const res = GET();
    const header = res.headers.get('cache-control');

    expect(header).not.toBeNull();
    expect(header).toContain('no-store');
  });
});
