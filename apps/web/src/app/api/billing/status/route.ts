import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { subscriptions } from '@synterra/db';

import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Internal-only endpoint — called by middleware on the same origin to check
// billing status without requiring auth headers. Not exposed in the public API
// surface (middleware routes are excluded from the public prefix list).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id');

  if (!workspaceId) {
    return NextResponse.json({ status: null });
  }

  const [sub] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  return NextResponse.json({ status: sub?.status ?? null });
}
