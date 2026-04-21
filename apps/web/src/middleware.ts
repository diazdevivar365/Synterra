import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

import { verifyWorkspaceJwt } from '@synterra/auth';

async function fetchBillingStatus(workspaceId: string, origin: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${origin}/api/billing/status?workspace_id=${encodeURIComponent(workspaceId)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { status: string | null };
    return data.status;
  } catch {
    return null;
  }
}

function getCachedBillingStatus(workspaceId: string, origin: string) {
  return unstable_cache(
    () => fetchBillingStatus(workspaceId, origin),
    [`billing-status-${workspaceId}`],
    { revalidate: 60 },
  )();
}

const PUBLIC_PREFIXES = [
  '/sign-in',
  '/verify',
  '/api/',
  '/_next/',
  '/favicon',
  '/workspaces',
  '/start',
  '/admin',
  '/privacy',
  '/terms',
  '/pricing',
  '/changelog',
  '/dev',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// better-auth prefixes session cookies with __Secure- on HTTPS in production
const SESSION_COOKIES = ['better-auth.session_token', '__Secure-better-auth.session_token'];
const WORKSPACE_COOKIE = 'synterra_wjwt';

// Exported for unit testing — returns a string action instead of NextResponse
// so tests don't need the full edge-runtime environment.
export async function resolveMiddlewareAction(
  req: NextRequest,
): Promise<'next' | `redirect:${string}`> {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return 'next';

  const session = SESSION_COOKIES.some((name) => req.cookies.has(name));
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
      const secret = process.env['WORKSPACE_JWT_SECRET'] ?? '';
      try {
        const payload = await verifyWorkspaceJwt(workspaceToken.value, secret);
        res.headers.set('x-user-id', payload.userId);
        res.headers.set('x-workspace-id', payload.workspaceId);
        res.headers.set('x-workspace-role', payload.role);
        res.headers.set('x-workspace-slug', payload.slug);

        // Check billing status — cached 60s per workspace to avoid a DB hit on
        // every request. Only annotates the response header; never blocks access.
        const origin = req.nextUrl.origin;
        const billingStatus = await getCachedBillingStatus(payload.workspaceId, origin);
        if (billingStatus === 'past_due') {
          res.headers.set('x-billing-status', 'past_due');
        }
      } catch {
        // Already verified above — should not happen.
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
