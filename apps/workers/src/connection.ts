/**
 * Synterra Workers — ioredis connection factory.
 *
 * BullMQ 5 requires `maxRetriesPerRequest: null` on any connection used by a
 * Worker or QueueEvents instance (see https://docs.bullmq.io/guide/connections).
 * We also disable the ready-check so that a slow Redis master during boot
 * does not block queue construction.
 *
 * The constructor is injectable so tests can substitute `ioredis-mock`.
 */
import IORedis, { type Redis, type RedisOptions } from 'ioredis';

import logger from './logger.js';

/**
 * Type of the `ioredis` constructor. Declared loosely so that drop-in
 * replacements (e.g. `ioredis-mock`) satisfy it without importing the real
 * package at type-check time.
 */
export type IoredisConstructor = new (url: string, options?: RedisOptions) => Redis;

export interface CreateRedisConnectionOptions {
  /**
   * Alternate ioredis constructor. Tests pass `RedisMock` here to avoid
   * touching a real Redis. Defaults to the real `ioredis` export.
   */
  IoredisCtor?: IoredisConstructor;
}

/**
 * Build a BullMQ-compatible ioredis connection.
 *
 * The connection is created with `lazyConnect: true` so the caller decides
 * when to `await conn.connect()` (bootstrap) vs. when BullMQ internals
 * establish it implicitly. Connection lifecycle events are logged with
 * structured fields.
 */
export function createRedisConnection(
  url: string,
  { IoredisCtor = IORedis as unknown as IoredisConstructor }: CreateRedisConnectionOptions = {},
): Redis {
  const options: RedisOptions = {
    // BullMQ hard requirement: workers/queues must not auto-retry individual
    // commands because BullMQ layers its own retry + backoff on top.
    maxRetriesPerRequest: null,
    // BullMQ convention: skip the INFO ready-check which can delay startup
    // against managed Redis instances that lag on boot.
    enableReadyCheck: false,
    // Let the caller explicitly `connect()` during bootstrap so boot errors
    // surface before we register workers.
    lazyConnect: true,
  };

  const conn = new IoredisCtor(url, options);

  conn.on('connect', () => {
    logger.info({ event: 'redis.connect' }, 'redis socket connected');
  });

  conn.on('ready', () => {
    logger.info({ event: 'redis.ready' }, 'redis client ready');
  });

  conn.on('error', (err: Error) => {
    logger.error({ event: 'redis.error', err: { message: err.message } }, 'redis error');
  });

  conn.on('close', () => {
    logger.warn({ event: 'redis.close' }, 'redis connection closed');
  });

  conn.on('reconnecting', (delay: number) => {
    logger.warn({ event: 'redis.reconnecting', delayMs: delay }, 'redis reconnecting');
  });

  conn.on('end', () => {
    logger.info({ event: 'redis.end' }, 'redis connection ended');
  });

  return conn;
}
