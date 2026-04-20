import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@synterra/db', () => ({
  createDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              status: 'preview_ready',
              previewData: { query: 'acme.com' },
              error: null,
            },
          ]),
        }),
      }),
    }),
  }),
  inflightBootstrap: {},
}));

describe('GET /api/onboarding/[id]/stream', () => {
  it('returns text/event-stream with status 200', async () => {
    const { GET } = await import('./route.js');
    const req = new NextRequest('http://localhost/api/onboarding/test-id/stream');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.status).toBe(200);
  });

  it('includes X-Accel-Buffering: no header', async () => {
    const { GET } = await import('./route.js');
    const req = new NextRequest('http://localhost/api/onboarding/test-id/stream');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.headers.get('X-Accel-Buffering')).toBe('no');
  });
});
