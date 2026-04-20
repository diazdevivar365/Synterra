import { createHash } from 'node:crypto';

import type IORedis from 'ioredis';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECS = 3600;

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + (process.env['IP_HASH_SALT'] ?? ''))
    .digest('hex')
    .slice(0, 16);
}

export async function checkRateLimit(
  redis: IORedis,
  ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:onboarding:${hashIp(ip)}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECS);
  }
  return {
    allowed: count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - count),
  };
}
