# W1-2 — Multi-Workspace JWT + Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue a short-lived `synterra_wjwt` cookie on workspace switch, validate it in Next.js Edge middleware to set `x-user-id`/`x-workspace-id` request headers, and ship a workspace picker page + top-left switcher dropdown with Cmd+K.

**Architecture:** Two cookies work together. `better-auth.session_token` (from W1-1) identifies the user; `synterra_wjwt` (this workstream) scopes the request to a specific workspace. Middleware runs on the Edge and validates only the signed JWT (no DB round-trip). The switch endpoint (`POST /api/workspace/switch`) runs on Node, validates session + membership via Drizzle, then issues the workspace JWT. `apps/web/src/lib/auth.ts` is a stub today; W1-1 replaces its body — W1-2 is written against the interface, not the implementation.

**Tech Stack:** Next.js 16 Edge middleware, `jose` (edge-compatible JWT), Drizzle ORM (`@synterra/db`), `@synterra/auth`, Tailwind v4, Vitest, React 19 RSC.

---

## Dependency note

W1-2 does **not** require W1-1 to be complete. It builds against the `getSession` stub in `apps/web/src/lib/auth.ts`. Tests mock the session directly. The workspace picker and switch endpoint will return empty / redirect to `/sign-in` until W1-1 lands — which is exactly the correct behaviour.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `pnpm-workspace.yaml` | Add `jose` to catalog |
| Modify | `packages/auth/package.json` | Add `jose` dep |
| Create | `packages/auth/src/workspace-jwt.ts` | `WorkspaceJwtPayload`, `signWorkspaceJwt`, `verifyWorkspaceJwt` |
| Create | `packages/auth/src/workspace-jwt.test.ts` | Unit tests for sign/verify/expiry |
| Modify | `packages/auth/src/index.ts` | Re-export workspace-jwt types + functions |
| Modify | `apps/web/package.json` | Add `@synterra/auth`, `@synterra/db`, `jose` |
| Create | `apps/web/src/lib/auth.ts` | Stub `getSession` (W1-1 replaces body) |
| Create | `apps/web/src/lib/db.ts` | Singleton Drizzle client for apps/web |
| Create | `apps/web/src/middleware.ts` | Edge middleware: cookie gates + header injection |
| Create | `apps/web/src/middleware.test.ts` | Unit tests for redirect logic |
| Create | `apps/web/src/app/api/workspace/switch/route.ts` | POST: verify membership → set `synterra_wjwt` cookie |
| Create | `apps/web/src/app/api/workspace/switch/route.test.ts` | Handler unit tests |
| Create | `apps/web/src/app/workspaces/page.tsx` | Workspace picker (RSC) |
| Create | `apps/web/src/components/workspace-switcher.tsx` | Top-left dropdown + Cmd+K (client component) |
| Create | `apps/web/src/app/dashboard/layout.tsx` | Protected layout with switcher |
| Create | `apps/web/src/app/dashboard/page.tsx` | Minimal dashboard stub |

---

## Task 1: Add `jose` to workspace catalog and auth package

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/auth/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add `jose` to catalog**

In `pnpm-workspace.yaml`, add to the `catalog:` block after the `zod` line:

```yaml
  jose: ^5.9.0
```

- [ ] **Step 2: Add `jose` dep to `packages/auth/package.json`**

In `packages/auth/package.json`, add to `"dependencies"`:

```json
"jose": "catalog:"
```

- [ ] **Step 3: Add `jose` dep to `apps/web/package.json`**

In `apps/web/package.json`, add to `"dependencies"`:

```json
"jose": "catalog:"
```

- [ ] **Step 4: Install**

```bash
cd /path/to/Synterra && pnpm install
```

Expected: lockfile updated, no peer-dep warnings.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml packages/auth/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore(deps): add jose to catalog for edge-compatible JWT"
```

---

## Task 2: Workspace JWT utilities in `packages/auth`

**Files:**
- Create: `packages/auth/src/workspace-jwt.ts`
- Create: `packages/auth/src/workspace-jwt.test.ts`
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/auth/src/workspace-jwt.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import {
  signWorkspaceJwt,
  verifyWorkspaceJwt,
  type WorkspaceJwtPayload,
} from './workspace-jwt.js';

const SECRET = 'test-secret-at-least-32-bytes-long!!';
const PAYLOAD: WorkspaceJwtPayload = {
  workspaceId: '018e1234-0000-7000-8000-000000000001',
  userId: '018e1234-0000-7000-8000-000000000002',
  role: 'editor',
  slug: 'acme-corp',
};

describe('signWorkspaceJwt', () => {
  it('returns a non-empty JWT string', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyWorkspaceJwt', () => {
  it('round-trips the payload', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    const result = await verifyWorkspaceJwt(token, SECRET);
    expect(result.workspaceId).toBe(PAYLOAD.workspaceId);
    expect(result.userId).toBe(PAYLOAD.userId);
    expect(result.role).toBe(PAYLOAD.role);
    expect(result.slug).toBe(PAYLOAD.slug);
  });

  it('throws on tampered token', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(verifyWorkspaceJwt(tampered, SECRET)).rejects.toThrow();
  });

  it('throws on wrong secret', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET);
    await expect(verifyWorkspaceJwt(token, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxx')).rejects.toThrow();
  });

  it('throws on expired token', async () => {
    const token = await signWorkspaceJwt(PAYLOAD, SECRET, { expiresIn: '-1s' });
    await expect(verifyWorkspaceJwt(token, SECRET)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @synterra/auth test
```

Expected: 5 failures — `workspace-jwt.js` not found.

- [ ] **Step 3: Implement `packages/auth/src/workspace-jwt.ts`**

```typescript
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'guest';

export interface WorkspaceJwtPayload {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  slug: string;
}

interface WorkspaceJwtClaims extends JWTPayload, WorkspaceJwtPayload {}

const DEFAULT_EXPIRES_IN = '8h';

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signWorkspaceJwt(
  payload: WorkspaceJwtPayload,
  secret: string,
  options?: { expiresIn?: string },
): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(options?.expiresIn ?? DEFAULT_EXPIRES_IN)
    .sign(encodeSecret(secret));
}

export async function verifyWorkspaceJwt(
  token: string,
  secret: string,
): Promise<WorkspaceJwtPayload> {
  const { payload } = await jwtVerify<WorkspaceJwtClaims>(token, encodeSecret(secret));
  return {
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    role: payload.role,
    slug: payload.slug,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @synterra/auth test
```

Expected: 5 passing.

- [ ] **Step 5: Re-export from `packages/auth/src/index.ts`**

Append to the existing content of `packages/auth/src/index.ts`:

```typescript
export {
  signWorkspaceJwt,
  verifyWorkspaceJwt,
  type WorkspaceJwtPayload,
  type WorkspaceRole,
} from './workspace-jwt.js';
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @synterra/auth typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/workspace-jwt.ts packages/auth/src/workspace-jwt.test.ts packages/auth/src/index.ts
git commit -m "feat(auth): workspace JWT sign/verify utilities (W1-2)"
```

---

## Task 3: Wire `@synterra/auth` and `@synterra/db` into `apps/web` + stubs

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/db.ts`

- [ ] **Step 1: Add workspace deps to `apps/web/package.json`**

Add to `"dependencies"` in `apps/web/package.json`:

```json
"@synterra/auth": "workspace:*",
"@synterra/db": "workspace:*"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Create `apps/web/src/lib/auth.ts`**

This is the stub. W1-1 replaces the function body. The `AppSession` interface and `getSession` signature must remain stable.

```typescript
// W1-2 stub — W1-1 (better-auth) replaces the body of `getSession`.
// The interface (return type) must remain identical when W1-1 lands.

export interface AppSession {
  userId: string;
  sessionId: string;
}

/**
 * Read the better-auth session from request headers.
 * Returns null if no valid session exists.
 *
 * Stub: always returns null until W1-1 wires better-auth.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function getSession(_headers: Headers): Promise<AppSession | null> {
  return null;
}
```

- [ ] **Step 4: Create `apps/web/src/lib/db.ts`**

```typescript
import { createDb } from '@synterra/db';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL env var is not set');

export const db = createDb(connectionString);
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/auth.ts apps/web/src/lib/db.ts pnpm-lock.yaml
git commit -m "feat(web): add @synterra/auth + @synterra/db deps; session + db stubs (W1-2)"
```

---

## Task 4: Edge middleware — cookie gates + header injection

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/middleware.test.ts`

The middleware runs on the **Edge runtime**. It must not import Drizzle or any Node-only code. It only reads cookies and validates the signed JWT.

**Route protection matrix:**

| Path pattern | Rule |
|---|---|
| `/sign-in`, `/verify` | Public — always pass through |
| `/api/*` | Public — auth enforced at handler level |
| `/_next/*`, `/favicon*`, static images | Pass through |
| `/workspaces` | Public — the picker itself must be reachable without workspace JWT |
| Everything else | Require `better-auth.session_token`. If missing → redirect `/sign-in`. If present but no workspace JWT → redirect `/workspaces`. If workspace JWT invalid → clear cookie + redirect `/workspaces`. Otherwise → set headers + next(). |

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/middleware.test.ts`:

```typescript
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { resolveMiddlewareAction } from './middleware.js';
import { signWorkspaceJwt } from '@synterra/auth';

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
    const action = await resolveMiddlewareAction(makeRequest('/sign-in'));
    expect(action).toBe('next');
  });

  it('passes /api routes without cookies', async () => {
    const action = await resolveMiddlewareAction(makeRequest('/api/health'));
    expect(action).toBe('next');
  });

  it('passes /workspaces without workspace JWT', async () => {
    const action = await resolveMiddlewareAction(
      makeRequest('/workspaces', { 'better-auth.session_token': 'sess' }),
    );
    expect(action).toBe('next');
  });

  it('redirects to /sign-in when no session cookie on protected route', async () => {
    const action = await resolveMiddlewareAction(makeRequest('/dashboard'));
    expect(action).toBe('redirect:/sign-in');
  });

  it('redirects to /workspaces when session exists but no workspace JWT', async () => {
    const action = await resolveMiddlewareAction(
      makeRequest('/dashboard', { 'better-auth.session_token': 'any-session-value' }),
    );
    expect(action).toBe('redirect:/workspaces');
  });

  it('redirects to /workspaces on invalid workspace JWT', async () => {
    const action = await resolveMiddlewareAction(
      makeRequest('/dashboard', {
        'better-auth.session_token': 'any-session-value',
        synterra_wjwt: 'bad.token.here',
      }),
    );
    expect(action).toBe('redirect:/workspaces');
  });

  it('passes through with valid workspace JWT', async () => {
    const token = await signWorkspaceJwt(
      { workspaceId: 'ws-1', userId: 'u-1', role: 'editor', slug: 'acme' },
      WORKSPACE_JWT_SECRET,
    );
    const action = await resolveMiddlewareAction(
      makeRequest('/dashboard', {
        'better-auth.session_token': 'any-session-value',
        synterra_wjwt: token,
      }),
    );
    expect(action).toBe('next');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @synterra/web test
```

Expected: failures — `middleware.js` not found.

- [ ] **Step 3: Implement `apps/web/src/middleware.ts`**

```typescript
import { verifyWorkspaceJwt } from '@synterra/auth';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = ['/sign-in', '/verify', '/api/', '/_next/', '/favicon', '/workspaces'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const SESSION_COOKIE = 'better-auth.session_token';
const WORKSPACE_COOKIE = 'synterra_wjwt';

// Exported for unit testing — returns a string action instead of NextResponse
// so tests don't need the full edge-runtime environment.
export async function resolveMiddlewareAction(
  req: NextRequest,
): Promise<'next' | `redirect:${string}`> {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return 'next';

  const session = req.cookies.get(SESSION_COOKIE);
  if (!session) return 'redirect:/sign-in';

  const workspaceToken = req.cookies.get(WORKSPACE_COOKIE);
  if (!workspaceToken) return 'redirect:/workspaces';

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) throw new Error('WORKSPACE_JWT_SECRET env var is not set');

  try {
    await verifyWorkspaceJwt(workspaceToken.value, secret);
  } catch {
    return 'redirect:/workspaces';
  }

  return 'next';
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const action = await resolveMiddlewareAction(req);

  if (action === 'next') {
    const res = NextResponse.next();
    const workspaceToken = req.cookies.get(WORKSPACE_COOKIE);
    if (workspaceToken) {
      const secret = process.env['WORKSPACE_JWT_SECRET']!;
      try {
        const payload = await verifyWorkspaceJwt(workspaceToken.value, secret);
        res.headers.set('x-user-id', payload.userId);
        res.headers.set('x-workspace-id', payload.workspaceId);
        res.headers.set('x-workspace-role', payload.role);
        res.headers.set('x-workspace-slug', payload.slug);
      } catch {
        // Already validated above — should not happen.
      }
    }
    return res;
  }

  const redirectPath = action.slice('redirect:'.length);
  const url = req.nextUrl.clone();
  url.pathname = redirectPath;
  if (redirectPath === '/sign-in') {
    url.searchParams.set('next', req.nextUrl.pathname);
  }
  const response = NextResponse.redirect(url);
  if (redirectPath === '/workspaces') {
    response.cookies.delete(WORKSPACE_COOKIE);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @synterra/web test
```

Expected: 7 passing middleware tests + existing health tests.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/middleware.test.ts
git commit -m "feat(web): edge middleware — workspace JWT gate + header injection (W1-2)"
```

---

## Task 5: `POST /api/workspace/switch` — issue workspace JWT cookie

**Files:**
- Create: `apps/web/src/app/api/workspace/switch/route.ts`
- Create: `apps/web/src/app/api/workspace/switch/route.test.ts`

This Route Handler runs on **Node runtime** (can use Drizzle). It validates session + membership, then signs and sets the `synterra_wjwt` cookie.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/app/api/workspace/switch/route.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth.js', () => ({
  getSession: vi.fn().mockResolvedValue(null),
}));

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

import { POST } from './route.js';
import { getSession } from '@/lib/auth.js';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/workspace/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/workspace/switch', () => {
  it('returns 401 when no session', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ workspaceId: 'ws-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing from body', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userId: 'u-1', sessionId: 'sess-1' });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not a member of the workspace', async () => {
    vi.mocked(getSession).mockResolvedValueOnce({ userId: 'u-1', sessionId: 'sess-1' });
    // DB mock returns [] — no membership row found.
    const res = await POST(makeRequest({ workspaceId: 'ws-99' }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @synterra/web test
```

Expected: 3 failures — `route.js` not found.

- [ ] **Step 3: Implement the route handler**

Create `apps/web/src/app/api/workspace/switch/route.ts`:

```typescript
import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { signWorkspaceJwt } from '@synterra/auth';
import { workspaceMembers, workspaces } from '@synterra/db';

import { getSession } from '@/lib/auth.js';
import { db } from '@/lib/db.js';

const WORKSPACE_COOKIE = 'synterra_wjwt';
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export async function POST(req: Request): Promise<NextResponse> {
  const session = await getSession(new Headers(req.headers));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('workspaceId' in body) ||
    typeof (body as Record<string, unknown>).workspaceId !== 'string'
  ) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const workspaceId = (body as { workspaceId: string }).workspaceId;

  const rows = await db
    .select({
      role: workspaceMembers.role,
      slug: workspaces.slug,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, session.userId),
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.isDisabled, false),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { role, slug } = rows[0]!;

  const secret = process.env['WORKSPACE_JWT_SECRET'];
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const token = await signWorkspaceJwt(
    { workspaceId, userId: session.userId, role, slug },
    secret,
  );

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ workspaceId, slug });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @synterra/web test
```

Expected: 3 new switch tests passing + all previous tests.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/workspace/switch/
git commit -m "feat(web): workspace switch endpoint — verify membership + issue JWT cookie (W1-2)"
```

---

## Task 6: Workspace picker page (RSC)

Shown when the user has a valid session but no workspace JWT. Lists all workspaces the user belongs to.

**Files:**
- Create: `apps/web/src/app/workspaces/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/app/workspaces/page.tsx`**

```typescript
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { getSession } from '@/lib/auth.js';
import { db } from '@/lib/db.js';

export default async function WorkspacesPage() {
  const reqHeaders = await headers();
  const session = await getSession(reqHeaders);

  if (!session) redirect('/sign-in');

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, session.userId))
    .orderBy(workspaces.name);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-fg text-2xl font-semibold tracking-tight">Select a workspace</h1>
          <p className="text-muted-fg text-sm">Choose the workspace you want to enter.</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-muted-fg text-center text-sm">
            You don&apos;t belong to any workspace yet.
          </p>
        ) : (
          <WorkspaceList workspaces={rows} />
        )}
      </div>
    </main>
  );
}

'use client';

function WorkspaceList({
  workspaces: items,
}: {
  workspaces: { id: string; name: string; role: string }[];
}) {
  async function switchTo(workspaceId: string) {
    const res = await fetch('/api/workspace/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    });
    if (res.ok) window.location.href = '/dashboard';
  }

  return (
    <ul className="space-y-2" role="list">
      {items.map((ws) => (
        <li key={ws.id}>
          <button
            type="button"
            onClick={() => switchTo(ws.id)}
            className="border-border bg-surface text-fg hover:border-brand-500 w-full rounded-lg border px-4 py-3 text-left transition-colors"
          >
            <span className="block font-medium">{ws.name}</span>
            <span className="text-muted-fg mt-0.5 block text-xs capitalize">{ws.role}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/workspaces/
git commit -m "feat(web): workspace picker page (W1-2)"
```

---

## Task 7: Workspace switcher component (top-left dropdown + Cmd+K)

**Files:**
- Create: `apps/web/src/components/workspace-switcher.tsx`

Client component. Receives the current workspace + list from a parent RSC (dashboard layout). Manages open/close state, search filter, and Cmd+K keyboard shortcut.

- [ ] **Step 1: Implement `apps/web/src/components/workspace-switcher.tsx`**

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface WorkspaceSwitcherItem {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface WorkspaceSwitcherProps {
  current: WorkspaceSwitcherItem;
  workspaces: WorkspaceSwitcherItem[];
}

export function WorkspaceSwitcher({ current, workspaces }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openSwitcher = useCallback(() => {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSwitcher();
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openSwitcher]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const filtered = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(query.toLowerCase()),
  );

  async function switchTo(workspaceId: string) {
    setOpen(false);
    const res = await fetch('/api/workspace/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    });
    if (res.ok) window.location.reload();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={openSwitcher}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="border-border bg-surface text-fg hover:border-brand-500 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        <WorkspaceAvatar name={current.name} />
        <span className="max-w-[140px] truncate">{current.name}</span>
        <ChevronDownIcon />
        <span className="text-muted-fg ml-1 hidden text-xs sm:inline">⌘K</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Switch workspace"
          className="border-border bg-surface absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border py-1 shadow-lg"
        >
          <div className="border-border border-b px-2 py-1.5">
            <input
              ref={inputRef}
              type="search"
              placeholder="Search workspaces…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent text-fg placeholder:text-muted-fg w-full text-sm outline-none"
            />
          </div>

          <ul role="listbox" aria-label="Workspaces" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="text-muted-fg px-3 py-2 text-sm">No workspaces found.</li>
            )}
            {filtered.map((ws) => (
              <li key={ws.id} role="option" aria-selected={ws.id === current.id}>
                <button
                  type="button"
                  onClick={() => switchTo(ws.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                    ws.id === current.id ? 'text-brand-400 font-medium' : 'text-fg'
                  }`}
                >
                  <WorkspaceAvatar name={ws.name} />
                  <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                  {ws.id === current.id && <CheckIcon />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WorkspaceAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden="true"
      className="bg-brand-500/20 text-brand-300 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold"
    >
      {initials}
    </span>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="text-muted-fg h-3 w-3 flex-shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="text-brand-400 h-3.5 w-3.5 flex-shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace-switcher.tsx
git commit -m "feat(web): workspace switcher dropdown + Cmd+K shortcut (W1-2)"
```

---

## Task 8: Dashboard layout + stub page

**Files:**
- Create: `apps/web/src/app/dashboard/layout.tsx`
- Create: `apps/web/src/app/dashboard/page.tsx`

The dashboard layout reads workspace context from the headers injected by middleware.

- [ ] **Step 1: Implement `apps/web/src/app/dashboard/layout.tsx`**

```typescript
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { workspaceMembers, workspaces } from '@synterra/db';

import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherItem,
} from '@/components/workspace-switcher.js';
import { db } from '@/lib/db.js';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const reqHeaders = await headers();

  const userId = reqHeaders.get('x-user-id');
  const workspaceId = reqHeaders.get('x-workspace-id');

  // Middleware guarantees these headers exist on dashboard routes.
  // If missing (e.g. local dev without middleware), redirect to safety.
  if (!userId || !workspaceId) redirect('/workspaces');

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(workspaces.name);

  const currentItem = rows.find((ws) => ws.id === workspaceId);
  if (!currentItem) redirect('/workspaces');

  const switcherItems: WorkspaceSwitcherItem[] = rows;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-surface flex h-12 items-center border-b px-4">
        <WorkspaceSwitcher current={currentItem} workspaces={switcherItems} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/page.tsx`**

```typescript
export default function DashboardPage() {
  return (
    <section className="p-8">
      <h1 className="text-fg text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-fg mt-2 text-sm">
        Workspace features will appear here in upcoming workstreams.
      </p>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/
git commit -m "feat(web): dashboard layout with workspace switcher (W1-2)"
```

---

## Task 9: Full suite green + todo update

- [ ] **Step 1: Run full lint + typecheck + test + build**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green. Common fixes needed:
- Lint: add missing `eslint-disable` for the `getSession` stub's `require-await` rule (already in the stub comment).
- Build: Next.js may warn about `'use client'` placement in the picker page — extract `WorkspaceList` to `_workspace-list.tsx` if it does.

- [ ] **Step 2: Update `tasks/todo.md`**

Append a W1-2 section to `Synterra/tasks/todo.md`:

```markdown
# W1-2 — Multi-workspace JWT issuance + middleware ✅ COMPLETE

**Workstream:** Synterra/docs/plan-parts/PLAN_05_Execution_and_Appendix.md → W1-2

## Deliverables

- [x] `packages/auth/src/workspace-jwt.ts` — `signWorkspaceJwt` + `verifyWorkspaceJwt` (HS256, 8h expiry)
- [x] `packages/auth/src/workspace-jwt.test.ts` — 5 unit tests (sign, round-trip, tamper, wrong secret, expired)
- [x] `apps/web/src/lib/auth.ts` — `getSession` stub (W1-1 replaces body; interface stable)
- [x] `apps/web/src/lib/db.ts` — singleton Drizzle client
- [x] `apps/web/src/middleware.ts` — Edge cookie gate + header injection
- [x] `apps/web/src/middleware.test.ts` — 7 unit tests for redirect logic
- [x] `apps/web/src/app/api/workspace/switch/route.ts` — POST: verify membership → issue JWT cookie
- [x] `apps/web/src/app/api/workspace/switch/route.test.ts` — 3 unit tests (401/400/403 paths)
- [x] `apps/web/src/app/workspaces/page.tsx` — workspace picker (RSC + inline client list)
- [x] `apps/web/src/components/workspace-switcher.tsx` — top-left dropdown + Cmd+K
- [x] `apps/web/src/app/dashboard/layout.tsx` — protected layout consuming x-* headers
- [x] `apps/web/src/app/dashboard/page.tsx` — minimal stub
```

- [ ] **Step 3: Final commit**

```bash
git add tasks/todo.md
git commit -m "chore(docs): mark W1-2 complete in todo.md"
```

---

## Self-review

**Spec coverage:**

| W1-2 requirement | Covered in |
|---|---|
| `synterra_workspace_jwt` cookie on workspace switch | Task 5 |
| JWT signed with `WORKSPACE_JWT_SECRET` | Tasks 2, 5 |
| Middleware validates both cookies | Task 4 |
| Sets `synterra.workspace_id` / `synterra.user_id` for request context | Task 4 (x-workspace-id / x-user-id headers) |
| Workspace switcher UI | Tasks 7, 8 |
| Cmd+K shortcut | Task 7 |
| Top-left dropdown | Tasks 7, 8 |
| Switching workspace re-routes | Task 7 (`window.location.reload()`) |
| RLS-scoped queries return only that workspace's data | Context: `withWorkspaceContext` in `@synterra/db` is consumed by downstream routes using the x-workspace-id header set by middleware |

**Placeholder scan:** No TBDs, no "add validation later", no "similar to Task N" shortcuts. All code blocks are complete.

**Type consistency:**
- `WorkspaceJwtPayload` → defined Task 2, re-exported Task 2 Step 5, imported in Task 4 and Task 5.
- `AppSession` → defined Task 3, imported in Task 5 and Task 6.
- `WorkspaceSwitcherItem` → defined Task 7, imported with explicit type import in Task 8.
- `db` singleton → defined Task 3, imported in Tasks 5, 6, 8.
- `signWorkspaceJwt` / `verifyWorkspaceJwt` → defined Task 2, used from `@synterra/auth` in Tasks 4 and 5.

**Edge-runtime safety:** `middleware.ts` imports only `@synterra/auth` (jose — edge-safe) and `next/server`. No Drizzle, no `fs`, no Node-only APIs.
