import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { createWorkOSClient, getSsoAuthorizationUrl } from '@synterra/auth';
import { ssoConnections, workspaces } from '@synterra/db';

import { db } from '@/lib/db';

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const workspaceSlug = searchParams.get('workspace');

  if (!workspaceSlug) {
    return NextResponse.json({ error: 'workspace is required' }, { status: 400 });
  }

  const apiKey = process.env['WORKOS_API_KEY'];
  const clientId = process.env['WORKOS_CLIENT_ID'];
  if (!apiKey || !clientId) {
    return NextResponse.json({ error: 'SSO is not configured' }, { status: 503 });
  }

  const rows = await db
    .select({
      connectionId: ssoConnections.workosConnectionId,
      enabled: ssoConnections.enabled,
    })
    .from(ssoConnections)
    .innerJoin(workspaces, eq(workspaces.id, ssoConnections.workspaceId))
    .where(eq(workspaces.slug, workspaceSlug))
    .limit(1);

  const conn = rows[0];
  if (!conn?.enabled || !conn.connectionId) {
    return NextResponse.json({ error: 'SSO not enabled for this workspace' }, { status: 404 });
  }

  const baseUrl = process.env['BETTER_AUTH_URL'] ?? '';
  const redirectUri = `${baseUrl}/api/auth/sso/callback`;
  const workos = createWorkOSClient(apiKey);

  const url = getSsoAuthorizationUrl(workos, {
    connectionId: conn.connectionId,
    clientId,
    redirectUri,
    state: workspaceSlug,
  });

  return NextResponse.redirect(url);
}
