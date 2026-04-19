import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/session.js', () => ({ getSessionOrThrow: vi.fn() }));
vi.mock('@/lib/db.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
}));

import { ForbiddenError } from '@/lib/errors.js';
import { getSessionOrThrow } from '@/lib/session.js';

import { POST } from './route.js';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/workspace/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/workspace/switch', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(getSessionOrThrow).mockRejectedValueOnce(new ForbiddenError());
    const res = await POST(makeRequest({ workspaceId: 'ws-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing', async () => {
    vi.mocked(getSessionOrThrow).mockResolvedValueOnce({
      userId: 'u-1',
      email: 'user@example.com',
    });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not a member', async () => {
    vi.mocked(getSessionOrThrow).mockResolvedValueOnce({
      userId: 'u-1',
      email: 'user@example.com',
    });
    const res = await POST(makeRequest({ workspaceId: 'ws-99' }));
    expect(res.status).toBe(403);
  });
});
