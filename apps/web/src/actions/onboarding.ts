'use server';

import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';
import IORedis from 'ioredis';
import { headers } from 'next/headers';

import { createDb, inflightBootstrap } from '@synterra/db';

import { getBootstrapAnonQueue } from '../lib/queue.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { verifyTurnstileToken } from '../lib/turnstile.js';

const db = createDb(process.env['DATABASE_URL'] ?? '');

function getRedis(): IORedis {
  return new IORedis(process.env['REDIS_URL'] ?? '', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export type OnboardingActionResult =
  | { ok: true; inflightId: string }
  | { ok: false; code: string; message: string };

export async function startOnboarding(
  urlInput: string,
  turnstileToken: string,
): Promise<OnboardingActionResult> {
  const hdrs = await headers();
  const ip =
    hdrs.get('cf-connecting-ip') ?? hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';

  const redis = getRedis();
  const { allowed } = await checkRateLimit(redis, ip);
  if (!allowed) {
    return { ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Try again in an hour.' };
  }

  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return {
      ok: false,
      code: 'CAPTCHA_FAILED',
      message: 'Captcha verification failed. Reload and try again.',
    };
  }

  let normalizedUrl: string;
  try {
    const raw = urlInput.trim();
    const withScheme =
      raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) throw new Error('no tld');
    normalizedUrl = u.toString();
  } catch {
    return {
      ok: false,
      code: 'INVALID_URL',
      message: 'Enter a valid website URL (e.g. acme.com).',
    };
  }

  const ipHash = createHash('sha256')
    .update(ip + (process.env['IP_HASH_SALT'] ?? ''))
    .digest('hex')
    .slice(0, 16);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [inflight] = await db
    .insert(inflightBootstrap)
    .values({ urlInput: normalizedUrl, ipHash, expiresAt, status: 'pending' })
    .returning({ id: inflightBootstrap.id });

  if (!inflight) {
    return { ok: false, code: 'DB_ERROR', message: 'Failed to create onboarding session.' };
  }

  const queue = getBootstrapAnonQueue();
  await queue.add('bootstrap-anon', { inflightId: inflight.id, urlInput: normalizedUrl });

  return { ok: true, inflightId: inflight.id };
}

export async function claimOnboarding(
  inflightId: string,
  workspaceId: string,
): Promise<{ ok: boolean; code?: string; message?: string }> {
  const [row] = await db
    .select({ status: inflightBootstrap.status, workspaceId: inflightBootstrap.workspaceId })
    .from(inflightBootstrap)
    .where(eq(inflightBootstrap.id, inflightId))
    .limit(1);

  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Onboarding session not found.' };
  if (row.status === 'claimed')
    return { ok: false, code: 'ALREADY_CLAIMED', message: 'Already claimed.' };
  if (row.status === 'failed')
    return { ok: false, code: 'RUN_FAILED', message: 'Preview run failed; start a new one.' };

  await db
    .update(inflightBootstrap)
    .set({ workspaceId, status: 'claimed', claimedAt: new Date() })
    .where(eq(inflightBootstrap.id, inflightId));

  const queue = getBootstrapAnonQueue();
  await queue.add('bootstrap-claim', { inflightId, workspaceId, urlInput: '' });

  return { ok: true };
}
