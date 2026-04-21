import { type NextRequest, NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/session';
import { getWorkspaceContext } from '@/lib/workspace-context';

const SLACK_SCOPES = 'chat:write,channels:read,channels:join';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    await getSessionOrThrow();
  } catch {
    return NextResponse.redirect(new URL('/start', _req.url));
  }

  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.redirect(new URL('/workspaces', _req.url));

  const clientId = process.env['SLACK_CLIENT_ID'];
  if (!clientId) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 503 });
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/slack/callback`;
  const state = Buffer.from(
    JSON.stringify({ workspaceId: ctx.workspaceId, slug: ctx.slug }),
  ).toString('base64url');

  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', SLACK_SCOPES);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
