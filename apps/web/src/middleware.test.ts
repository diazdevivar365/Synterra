// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { signWorkspaceJwt } from '@synterra/auth';

import { middleware, resolveMiddlewareAction } from './middleware';

const WORKSPACE_JWT_SECRET = 'test-secret-at-least-32-bytes-long!!';

vi.stubEnv('WORKSPACE_JWT_SECRET', WORKSPACE_JWT_SECRET);

function makeRequest(path: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${path}`;
  const req = new NextRequest(url);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe('resolveMiddlewareAction', () => {
  it('passes /sign-in without cookies', async () => {
    expect(await resolveMiddlewareAction(makeRequest('/sign-in'))).toBe('next');
  });

  it('passes /api routes without cookies', async () => {
    expect(await resolveMiddlewareAction(makeRequest('/api/health'))).toBe('next');
  });

  it('passes /workspaces without workspace JWT', async () => {
    expect(
      await resolveMiddlewareAction(
        makeRequest('/workspaces', { 'better-auth.session_token': 'sess' }),
      ),
    ).toBe('next');
  });

  it('redirects to /sign-in when no session cookie on protected route', async () => {
    expect(await resolveMiddlewareAction(makeRequest('/dashboard'))).toBe('redirect:/sign-in');
  });

  it('redirects to /workspaces when session exists but no workspace JWT', async () => {
    expect(
      await resolveMiddlewareAction(
        makeRequest('/dashboard', { 'better-auth.session_token': 'any-value' }),
      ),
    ).toBe('redirect:/workspaces');
  });

  it('redirects to /workspaces on invalid workspace JWT', async () => {
    expect(
      await resolveMiddlewareAction(
        makeRequest('/dashboard', {
          'better-auth.session_token': 'any-value',
          synterra_wjwt: 'bad.token.here',
        }),
      ),
    ).toBe('redirect:/workspaces');
  });

  it('passes through with valid workspace JWT', async () => {
    const token = await signWorkspaceJwt(
      { workspaceId: 'ws-1', userId: 'u-1', role: 'editor', slug: 'acme' },
      WORKSPACE_JWT_SECRET,
    );
    expect(
      await resolveMiddlewareAction(
        makeRequest('/dashboard', {
          'better-auth.session_token': 'any-value',
          synterra_wjwt: token,
        }),
      ),
    ).toBe('next');
  });
});

describe('middleware', () => {
  it('redirects unauthenticated /dashboard to /sign-in', async () => {
    const req = makeRequest('/dashboard');
    const res = await middleware(req);
    expect(res.headers.get('location')).toContain('/sign-in');
  });

  it('redirects to /workspaces when session present but no workspace JWT', async () => {
    // A session cookie without a workspace JWT → redirect to /workspaces to
    // pick a workspace; this verifies the middleware passes beyond the auth
    // check and reaches workspace enforcement.
    const req = makeRequest('/dashboard', { 'better-auth.session_token': 'any-value' });
    const res = await middleware(req);
    expect(res.headers.get('location')).toContain('/workspaces');
  });

  it('skips non-protected paths (/sign-in)', async () => {
    const req = makeRequest('/sign-in');
    const res = await middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});
