import 'server-only';

import { createDecipheriv } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { aquilaCredentials } from '@synterra/db';

import { db } from '@/lib/db';

const BASE = process.env['AQUILA_BASE_URL'] ?? '';
const ENCRYPT_HEX = process.env['AQUILA_ENCRYPT_KEY'] ?? '';

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Module-level cache — safe in long-running Next.js server process.
const tokenCache = new Map<string, TokenCache>();

function decryptApiKey(enc: Buffer): string {
  const iv = enc.subarray(0, 12);
  const authTag = enc.subarray(12, 28);
  const ciphertext = enc.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPT_HEX, 'hex'), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function getServiceToken(workspaceId: string, apiKey: string): Promise<string> {
  const cached = tokenCache.get(workspaceId);
  // 60s buffer before expiry
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(`${BASE}/auth/issue-service-token`, {
    method: 'POST',
    headers: { 'X-Aquila-API-Key': apiKey },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`service-token: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(workspaceId, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

async function getCredentials(workspaceId: string): Promise<{ apiKey: string } | null> {
  if (!BASE || !ENCRYPT_HEX) return null;
  const rows = await db
    .select({ enc: aquilaCredentials.apiKeySecretEnc })
    .from(aquilaCredentials)
    .where(eq(aquilaCredentials.workspaceId, workspaceId))
    .limit(1);
  if (!rows[0]) return null;
  try {
    return { apiKey: decryptApiKey(rows[0].enc) };
  } catch {
    return null;
  }
}

export async function aquilaFetchRaw(workspaceId: string, path: string): Promise<Response | null> {
  const creds = await getCredentials(workspaceId);
  if (!creds) return null;
  try {
    const token = await getServiceToken(workspaceId, creds.apiKey);
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

export async function hasAquilaCredentials(workspaceId: string): Promise<boolean> {
  const rows = await db
    .select({ workspaceId: aquilaCredentials.workspaceId })
    .from(aquilaCredentials)
    .where(eq(aquilaCredentials.workspaceId, workspaceId))
    .limit(1);
  return rows.length > 0;
}

export async function aquilaFetch<T>(
  workspaceId: string,
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const creds = await getCredentials(workspaceId);
  if (!creds) return null;
  try {
    const token = await getServiceToken(workspaceId, creds.apiKey);
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
