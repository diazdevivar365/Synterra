// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------
const {
  mockSelect,
  mockUpdate,
  mockGetSession,
  mockCreateWorkspace,
  mockSignWorkspaceJwt,
  mockCookiesSet,
} = vi.hoisted(() => {
  const cookiesSet = vi.fn();
  return {
    mockSelect: vi.fn(),
    mockUpdate: vi.fn(),
    mockGetSession: vi.fn(),
    mockCreateWorkspace: vi.fn(),
    mockSignWorkspaceJwt: vi.fn().mockResolvedValue('signed-jwt-token'),
    mockCookiesSet: cookiesSet,
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
      getSession: mockGetSession,
    },
  },
}));

vi.mock('@/actions/workspace', () => ({
  createWorkspace: mockCreateWorkspace,
}));

vi.mock('@synterra/auth', () => ({
  signWorkspaceJwt: mockSignWorkspaceJwt,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockCookiesSet }),
}));

vi.mock('@synterra/db', () => ({
  inflightBootstrap: {},
  workspaceMembers: {},
  workspaces: {},
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

import { GET } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeReq(search = ''): NextRequest {
  return new NextRequest(`http://localhost/api/start/claim${search}`, {
    method: 'GET',
    headers: { host: 'localhost' },
  });
}

interface BootstrapRow {
  id?: string;
  sessionId?: string;
  status: string;
  url?: string;
  workspaceId?: string | null;
  userId?: string | null;
  ip?: string | null;
  email?: string | null;
  aquilaRunId?: string | null;
  result?: unknown;
  expiresAt?: Date;
  createdAt?: Date;
}

// Sets up the first mockSelect call — used for the inflightBootstrap lookup.
function setupBootstrapSelectChain(rows: BootstrapRow[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  mockSelect.mockReturnValueOnce({ from: fromMock });
  return { limitMock, whereMock, fromMock };
}

// Sets up a subsequent mockSelect call — used for the workspaceMembers join
// inside switchToWorkspace.
function setupMemberSelectChain(rows: { role: string; slug: string }[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
  const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
  mockSelect.mockReturnValueOnce({ from: fromMock });
  return { limitMock };
}

function setupUpdateChain() {
  const whereMock = vi.fn().mockResolvedValue([]);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  mockUpdate.mockReturnValue({ set: setMock });
  return { setMock, whereMock };
}

const FAKE_USER = { id: 'user-1', email: 'user@example.com', name: 'Test User' };
const FAKE_SESSION = { user: FAKE_USER, session: { id: 'session-abc' } };

const PENDING_ROW: BootstrapRow = {
  id: 'row-1',
  sessionId: 'sess-ok',
  status: 'pending',
  url: 'https://acme.com',
  workspaceId: null,
  userId: null,
  ip: '1.2.3.4',
  email: 'user@example.com',
  aquilaRunId: null,
  result: null,
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
  vi.stubEnv('WORKSPACE_JWT_SECRET', 'test-secret-at-least-32-chars-long!!');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/start/claim', () => {
  describe('missing ?session param', () => {
    it('redirects to /start when session query param is absent', async () => {
      const res = await GET(makeReq());
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/start');
    });
  });

  describe('no auth session', () => {
    it('redirects to /sign-in when user is not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const res = await GET(makeReq('?session=sess-abc'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/sign-in');
    });

    it('includes a next= param pointing back to the claim URL with the sessionId', async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const res = await GET(makeReq('?session=sess-abc'));
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('next=');
      expect(location).toContain('sess-abc');
    });
  });

  describe('row expired or not found', () => {
    it('redirects to /start when no row is found for the sessionId', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([]);

      const res = await GET(makeReq('?session=nonexistent'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/start');
    });

    it('redirects to /start when row status is "expired"', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([{ ...PENDING_ROW, status: 'expired' }]);

      const res = await GET(makeReq('?session=sess-expired'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/start');
    });
  });

  describe('row already claimed', () => {
    it('switches to the existing workspace and redirects to /dashboard', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([
        { ...PENDING_ROW, status: 'claimed', workspaceId: 'ws-existing' },
      ]);
      setupMemberSelectChain([{ role: 'owner', slug: 'acme' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      const res = await GET(makeReq('?session=sess-claimed'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/dashboard');
    });

    it('still redirects to /dashboard even if member lookup returns no rows', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([
        { ...PENDING_ROW, status: 'claimed', workspaceId: 'ws-existing' },
      ]);
      // switchToWorkspace returns early when no membership found
      setupMemberSelectChain([]);

      const res = await GET(makeReq('?session=sess-claimed'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/dashboard');
    });
  });

  describe('happy path — new workspace created', () => {
    it('creates workspace and redirects to /dashboard', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({ ok: true, data: { workspaceId: 'ws-new' } });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      const res = await GET(makeReq('?session=sess-ok'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/dashboard');
    });

    it('calls createWorkspace with name and slug derived from the row URL', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({ ok: true, data: { workspaceId: 'ws-new' } });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      await GET(makeReq('?session=sess-ok'));

      expect(mockCreateWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(String),
          slug: expect.any(String),
        }),
      );
    });

    it('marks the bootstrap row as claimed with userId and workspaceId', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      const { setMock } = setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({ ok: true, data: { workspaceId: 'ws-new' } });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      await GET(makeReq('?session=sess-ok'));

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'claimed',
          userId: 'user-1',
          workspaceId: 'ws-new',
        }),
      );
    });

    it('sets the synterra_wjwt cookie with httpOnly flag', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({ ok: true, data: { workspaceId: 'ws-new' } });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      await GET(makeReq('?session=sess-ok'));

      expect(mockCookiesSet).toHaveBeenCalledWith(
        'synterra_wjwt',
        'jwt-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('slug collision — retry with suffix', () => {
    it('retries with a suffixed slug when first createWorkspace fails, and redirects to /dashboard', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({
        ok: false,
        code: 'CONFLICT',
        message: 'Slug already taken',
      });
      mockCreateWorkspace.mockResolvedValueOnce({
        ok: true,
        data: { workspaceId: 'ws-retry' },
      });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme-ab1c' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      const res = await GET(makeReq('?session=sess-ok'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/dashboard');
      expect(mockCreateWorkspace).toHaveBeenCalledTimes(2);
    });

    it('uses a different suffixed slug on the retry call', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({
        ok: false,
        code: 'CONFLICT',
        message: 'Slug already taken',
      });
      mockCreateWorkspace.mockResolvedValueOnce({
        ok: true,
        data: { workspaceId: 'ws-retry' },
      });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme-ab1c' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      await GET(makeReq('?session=sess-ok'));

      const firstSlug = (mockCreateWorkspace.mock.calls[0]?.[0] as { slug: string }).slug;
      const secondSlug = (mockCreateWorkspace.mock.calls[1]?.[0] as { slug: string }).slug;
      expect(secondSlug).not.toBe(firstSlug);
      expect(secondSlug).toMatch(new RegExp(`^${firstSlug}-[a-z0-9]+$`));
    });

    it('redirects to /workspaces when both workspace creation attempts fail', async () => {
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({
        ok: false,
        code: 'CONFLICT',
        message: 'Slug already taken',
      });
      mockCreateWorkspace.mockResolvedValueOnce({
        ok: false,
        code: 'CONFLICT',
        message: 'Slug still taken',
      });

      const res = await GET(makeReq('?session=sess-ok'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/workspaces');
    });
  });

  describe('edge cases', () => {
    it('derives workspace name from www-prefixed URL by stripping www', async () => {
      const rowWithWww: BootstrapRow = { ...PENDING_ROW, url: 'https://www.acme.com' };
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([rowWithWww]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({ ok: true, data: { workspaceId: 'ws-www' } });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      await GET(makeReq('?session=sess-ok'));

      const callArg = mockCreateWorkspace.mock.calls[0]?.[0] as { name: string; slug: string };
      expect(callArg.name).toBe('Acme');
      expect(callArg.slug).toBe('acme');
    });

    it('uses NEXT_PUBLIC_APP_URL env var as base for redirect', async () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.forgentic.io');
      mockGetSession.mockResolvedValueOnce(FAKE_SESSION);
      setupBootstrapSelectChain([PENDING_ROW]);
      setupUpdateChain();
      mockCreateWorkspace.mockResolvedValueOnce({ ok: true, data: { workspaceId: 'ws-new' } });
      setupMemberSelectChain([{ role: 'owner', slug: 'acme' }]);
      mockSignWorkspaceJwt.mockResolvedValueOnce('jwt-token');

      const res = await GET(makeReq('?session=sess-ok'));
      expect(res.headers.get('location')).toContain('app.forgentic.io');
    });
  });
});
