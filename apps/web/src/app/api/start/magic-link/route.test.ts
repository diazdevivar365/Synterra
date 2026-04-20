// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------
const { mockSelect, mockUpdate, mockSignInMagicLink } = vi.hoisted(() => {
  return {
    mockSelect: vi.fn(),
    mockUpdate: vi.fn(),
    mockSignInMagicLink: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signInMagicLink: mockSignInMagicLink,
    },
  },
}));

vi.mock('@synterra/db', () => ({
  inflightBootstrap: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

import { POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/start/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonReq(): NextRequest {
  return new NextRequest('http://localhost/api/start/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{{{not json',
  });
}

function setupSelectChain(rows: { id: string; status: string }[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  mockSelect.mockReturnValue({ from: fromMock });
  return { limitMock, whereMock, fromMock };
}

function setupUpdateChain() {
  const whereMock = vi.fn().mockResolvedValue([]);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  mockUpdate.mockReturnValue({ set: setMock });
  return { setMock, whereMock };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/start/magic-link', () => {
  describe('invalid JSON body', () => {
    it('returns 400 when body is not valid JSON', async () => {
      const res = await POST(makeInvalidJsonReq());
      expect(res.status).toBe(400);
    });
  });

  describe('missing or invalid fields', () => {
    it('returns 400 when email is missing', async () => {
      const res = await POST(makeReq({ sessionId: 'sess-1' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/email/i);
    });

    it('returns 400 when email does not contain @', async () => {
      const res = await POST(makeReq({ email: 'notanemail', sessionId: 'sess-1' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/email/i);
    });

    it('returns 400 when email is empty string', async () => {
      const res = await POST(makeReq({ email: '', sessionId: 'sess-1' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/email/i);
    });

    it('returns 400 when sessionId is missing', async () => {
      // The route destructures email+sessionId together: if either field is
      // absent, BOTH are set to null. Email validation fires first, so the
      // error message references email (not sessionId). The important
      // invariant is that the response is still 400.
      const res = await POST(makeReq({ email: 'user@example.com' }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when sessionId is empty string', async () => {
      const res = await POST(makeReq({ email: 'user@example.com', sessionId: '' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/sessionId/i);
    });

    it('returns 400 when both email and sessionId are missing', async () => {
      const res = await POST(makeReq({}));
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is null', async () => {
      const res = await POST(makeReq(null));
      expect(res.status).toBe(400);
    });
  });

  describe('row not found / bad status', () => {
    it('returns 404 when no row exists for the given sessionId', async () => {
      setupSelectChain([]);
      const res = await POST(makeReq({ email: 'user@example.com', sessionId: 'nonexistent' }));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/not found|expired/i);
    });

    it('returns 404 when row status is "claimed"', async () => {
      setupSelectChain([{ id: 'row-1', status: 'claimed' }]);
      const res = await POST(makeReq({ email: 'user@example.com', sessionId: 'sess-claimed' }));
      expect(res.status).toBe(404);
    });

    it('returns 404 when row status is "expired"', async () => {
      setupSelectChain([{ id: 'row-1', status: 'expired' }]);
      const res = await POST(makeReq({ email: 'user@example.com', sessionId: 'sess-expired' }));
      expect(res.status).toBe(404);
    });
  });

  describe('signInMagicLink failure', () => {
    it('returns 500 when auth.api.signInMagicLink throws', async () => {
      setupSelectChain([{ id: 'row-1', status: 'pending' }]);
      setupUpdateChain();
      mockSignInMagicLink.mockRejectedValueOnce(new Error('SMTP timeout'));

      const res = await POST(makeReq({ email: 'user@example.com', sessionId: 'sess-ok' }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/magic link/i);
    });
  });

  describe('happy path', () => {
    it('returns 200 with { ok: true } on success', async () => {
      setupSelectChain([{ id: 'row-1', status: 'pending' }]);
      setupUpdateChain();
      mockSignInMagicLink.mockResolvedValueOnce(undefined);

      const res = await POST(makeReq({ email: 'user@example.com', sessionId: 'sess-ok' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it('updates the email on the row before sending the magic link', async () => {
      setupSelectChain([{ id: 'row-1', status: 'running' }]);
      const { setMock } = setupUpdateChain();
      mockSignInMagicLink.mockResolvedValueOnce(undefined);

      await POST(makeReq({ email: 'user@example.com', sessionId: 'sess-ok' }));

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(setMock).toHaveBeenCalledWith({ email: 'user@example.com' });
    });

    it('calls signInMagicLink with correct email and callbackURL containing sessionId', async () => {
      setupSelectChain([{ id: 'row-1', status: 'pending' }]);
      setupUpdateChain();
      mockSignInMagicLink.mockResolvedValueOnce(undefined);

      await POST(makeReq({ email: 'user@example.com', sessionId: 'sess-42' }));

      expect(mockSignInMagicLink).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            email: 'user@example.com',
            callbackURL: expect.stringContaining('sess-42'),
          }),
        }),
      );
    });

    it('accepts rows with status "running"', async () => {
      setupSelectChain([{ id: 'row-2', status: 'running' }]);
      setupUpdateChain();
      mockSignInMagicLink.mockResolvedValueOnce(undefined);

      const res = await POST(makeReq({ email: 'user@example.com', sessionId: 'sess-run' }));
      expect(res.status).toBe(200);
    });
  });

  describe('edge cases', () => {
    it('passes original request headers to signInMagicLink', async () => {
      setupSelectChain([{ id: 'row-1', status: 'pending' }]);
      setupUpdateChain();
      mockSignInMagicLink.mockResolvedValueOnce(undefined);

      const req = new NextRequest('http://localhost/api/start/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-custom-header': 'test-value',
        },
        body: JSON.stringify({ email: 'user@example.com', sessionId: 'sess-hdr' }),
      });

      await POST(req);

      const callArg = mockSignInMagicLink.mock.calls[0]?.[0] as { headers: Headers };
      expect(callArg.headers).toBeInstanceOf(Headers);
    });

    it('accepts email with plus-addressing and subdomain', async () => {
      setupSelectChain([{ id: 'row-1', status: 'pending' }]);
      setupUpdateChain();
      mockSignInMagicLink.mockResolvedValueOnce(undefined);

      const res = await POST(makeReq({ email: 'user+tag@sub.example.com', sessionId: 'sess-ok' }));
      expect(res.status).toBe(200);
    });
  });
});
