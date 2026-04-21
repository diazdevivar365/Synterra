import { createCipheriv, randomBytes } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { serviceRoleQuery, slackConnections } from '@synterra/db';

import { db } from '@/lib/db';

function encryptToken(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id: string; name: string };
}

interface SlackChannelListResponse {
  ok: boolean;
  channels?: { id: string; name: string; is_general?: boolean }[];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error === 'access_denied') {
    return NextResponse.redirect(new URL('/workspaces', req.url));
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  let workspaceId: string;
  let slug: string;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      workspaceId: string;
      slug: string;
    };
    workspaceId = parsed.workspaceId;
    slug = parsed.slug;
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  const clientId = process.env['SLACK_CLIENT_ID'];
  const clientSecret = process.env['SLACK_CLIENT_SECRET'];
  const encryptKey = process.env['SLACK_TOKEN_ENCRYPT_KEY'];

  if (!clientId || !clientSecret || !encryptKey) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 503 });
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/slack/callback`;

  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = (await tokenRes.json()) as SlackOAuthResponse;

  if (!tokenData.ok || !tokenData.access_token || !tokenData.team) {
    return NextResponse.json({ error: tokenData.error ?? 'oauth_failed' }, { status: 400 });
  }

  const channelRes = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel&limit=200',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );
  const channelData = (await channelRes.json()) as SlackChannelListResponse;
  const general = channelData.channels?.find((c) => c.is_general) ?? channelData.channels?.[0];

  const defaultChannelId = general?.id ?? 'C000000';
  const defaultChannelName = general?.name ?? 'general';
  const encryptedBotToken = encryptToken(tokenData.access_token, encryptKey);
  const { id: teamId, name: teamName } = tokenData.team;

  await serviceRoleQuery(db, (tx) =>
    tx
      .insert(slackConnections)
      .values({
        workspaceId,
        teamId,
        teamName,
        encryptedBotToken,
        defaultChannelId,
        defaultChannelName,
        isEnabled: true,
      })
      .onConflictDoUpdate({
        target: slackConnections.workspaceId,
        set: {
          teamId,
          teamName,
          encryptedBotToken,
          defaultChannelId,
          defaultChannelName,
          isEnabled: true,
          updatedAt: new Date(),
        },
      }),
  );

  return NextResponse.redirect(new URL(`/${slug}/settings/slack`, req.url));
}
