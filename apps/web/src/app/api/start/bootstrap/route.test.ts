// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------
const { mockSelect, mockInsert, mockUpdate } = vi.hoisted(() => {
  return {
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock('@synterra/db', () => ({
  inflightBootstrap: {},
}));

vi.mock('drizzle-orm', () => {
  // `sql` is used as a tagged template literal: sql`count(*)::int`
  // It must be callable (a function), not just an object/Proxy.
  const sqlFn = vi.fn(() => ({}));
  return {
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    gte: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    sql: sqlFn,
  };
});

vi.mock('@synterra/aquila-client', () => ({
  createAquilaClient: vi.fn(),
  SUPPORTED_CONTRACT_VERSION: '2024-01-01',
}));

// eslint-disable-next-line import/order
import { POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeReq(body: unknown, ip = '1.2.3.4'): NextRequest {
  return new NextRequest('http://localhost/api/start/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonReq(): NextRequest {
  return new NextRequest('http://localhost/api/start/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-valid-json{{{',
  });
}

function setupSelectChain(count: number) {
  const whereMock = vi.fn().mockResolvedValue([{ count }]);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  mockSelect.mockReturnValue({ from: fromMock });
  return { whereMock, fromMock };
}

function setupInsertChain(sessionId: string) {
  const returningMock = vi.fn().mockResolvedValue([{ sessionId }]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
  mockInsert.mockReturnValue({ values: valuesMock });
  return { returningMock, valuesMock };
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
describe('POST /api/start/bootstrap', () => {
  describe('invalid JSON body', () => {
    it('returns 400 with "Invalid JSON" when body is not valid JSON', async () => {
      const res = await POST(makeInvalidJsonReq());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid json/i);
    });
  });

  describe('missing or invalid url', () => {
    it('returns 400 when url field is absent from body', async () => {
      setupSelectChain(0);
      const res = await POST(makeReq({ notUrl: 'something' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/url/i);
    });

    it('returns 400 when url is an empty string', async () => {
      setupSelectChain(0);
      const res = await POST(makeReq({ url: '   ' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/url/i);
    });

    it('returns 400 when url cannot be normalised', async () => {
      setupSelectChain(0);
      const res = await POST(makeReq({ url: ':::bad:::url:::' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid url/i);
    });

    it('returns 400 when url field is not a string', async () => {
      setupSelectChain(0);
      const res = await POST(makeReq({ url: 12345 }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/url/i);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 when IP has exactly 5 requests in the last hour', async () => {
      setupSelectChain(5);
      const res = await POST(makeReq({ url: 'https://example.com' }));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toMatch(/too many/i);
    });

    it('returns 429 when IP count is well above the limit', async () => {
      setupSelectChain(99);
      const res = await POST(makeReq({ url: 'https://example.com' }));
      expect(res.status).toBe(429);
    });
  });

  describe('happy path', () => {
    it('returns 201 with sessionId when URL is valid and under rate limit', async () => {
      setupSelectChain(0);
      setupInsertChain('session-abc');
      setupUpdateChain();

      const res = await POST(makeReq({ url: 'https://acme.com' }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(typeof body.sessionId).toBe('string');
      expect(body.sessionId.length).toBeGreaterThan(0);
    });

    it('accepts URL without protocol prefix (adds https://)', async () => {
      setupSelectChain(0);
      setupInsertChain('no-protocol-session');
      setupUpdateChain();

      const res = await POST(makeReq({ url: 'acme.com' }));
      expect(res.status).toBe(201);
    });

    it('inserts a row with correct url, ip, and status=pending', async () => {
      setupSelectChain(2);
      const { valuesMock } = setupInsertChain('session-42');
      setupUpdateChain();

      await POST(makeReq({ url: 'https://acme.com' }));

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://acme.com',
          ip: '1.2.3.4',
          status: 'pending',
        }),
      );
    });

    it('updates status to running after inserting the row', async () => {
      setupSelectChain(0);
      setupInsertChain('upd-session');
      const { setMock } = setupUpdateChain();

      await POST(makeReq({ url: 'https://example.com' }));

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' }),
      );
    });

    it('reads IP from cf-connecting-ip header when present (preferred over x-forwarded-for)', async () => {
      setupSelectChain(0);
      setupInsertChain('cf-session');
      setupUpdateChain();
      // Re-wire insert to capture values
      const returningMock = vi.fn().mockResolvedValue([{ sessionId: 'cf-session' }]);
      const vMock = vi.fn().mockReturnValue({ returning: returningMock });
      mockInsert.mockReturnValue({ values: vMock });

      const req = new NextRequest('http://localhost/api/start/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '5.6.7.8',
          'x-forwarded-for': '9.9.9.9',
        },
        body: JSON.stringify({ url: 'https://example.com' }),
      });

      await POST(req);

      expect(vMock).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '5.6.7.8' }),
      );
    });

    it('returns 500 when the insert returns an empty array', async () => {
      setupSelectChain(0);
      const returningMock = vi.fn().mockResolvedValue([]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      mockInsert.mockReturnValue({ values: valuesMock });

      const res = await POST(makeReq({ url: 'https://example.com' }));
      expect(res.status).toBe(500);
    });
  });

  describe('edge cases', () => {
    it('allows a count of 4 (one below the limit)', async () => {
      setupSelectChain(4);
      setupInsertChain('edge-session');
      setupUpdateChain();

      const res = await POST(makeReq({ url: 'https://example.com' }));
      expect(res.status).toBe(201);
    });

    it('falls back to "unknown" IP when no IP header is present', async () => {
      setupSelectChain(0);
      const returningMock = vi.fn().mockResolvedValue([{ sessionId: 'no-ip-session' }]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      mockInsert.mockReturnValue({ values: valuesMock });
      setupUpdateChain();

      const req = new NextRequest('http://localhost/api/start/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ ip: 'unknown' }),
      );
    });

    it('normalises url to origin only (strips path)', async () => {
      setupSelectChain(0);
      const returningMock = vi.fn().mockResolvedValue([{ sessionId: 'strip-path-session' }]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      mockInsert.mockReturnValue({ values: valuesMock });
      setupUpdateChain();

      await POST(makeReq({ url: 'https://acme.com/some/deep/path?foo=bar' }));

      expect(valuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://acme.com' }),
      );
    });
  });
});
