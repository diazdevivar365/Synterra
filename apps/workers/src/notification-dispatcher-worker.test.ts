/**
 * notification-dispatcher-worker unit tests.
 *
 * DB and Resend are mocked. Redis is mocked via ioredis-mock.
 * config.ts is hoisted-mocked so Zod env parser never sees real env vars.
 */
import RedisMock from 'ioredis-mock';
import { describe, expect, it, vi } from 'vitest';

import { createNotificationDispatcherWorker } from './notification-dispatcher-worker.js';
import { QUEUE_NAMES } from './queues.js';

import type { Redis } from 'ioredis';

vi.mock('./config.js', () => ({
  env: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://localhost:6379',
    HEALTH_PORT: 3002,
    LOG_LEVEL: 'silent',
    SHUTDOWN_TIMEOUT_MS: 15_000,
    WORKER_CONCURRENCY: 5,
    DATABASE_URL: 'postgres://localhost:5432/test',
    STRIPE_SECRET_KEY: 'sk_test_xxx',
    AQUILA_BASE_URL: 'https://aquila.test.invalid',
    AQUILA_PROVISIONER_SECRET: 'test-provisioner-secret-1234',
    AQUILA_ENCRYPT_KEY: 'a'.repeat(64),
    LAGO_API_URL: 'http://localhost:3000',
    LAGO_API_KEY: 'lago-test',
    RESEND_API_KEY: 're_test_xxx',
  },
}));

vi.mock('./logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

vi.mock('@synterra/db', () => ({
  createDb: vi.fn(() => ({})),
  serviceRoleQuery: vi.fn((_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ select: vi.fn(), insert: vi.fn(), update: vi.fn() }),
  ),
  notificationSubscriptions: {},
  notificationDeliveries: {},
  users: {},
}));

const mockEmailsSend = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null });
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

describe('createNotificationDispatcherWorker', () => {
  it('returns a Worker bound to QUEUE_NAMES.NOTIFICATIONS', () => {
    const conn = new RedisMock() as unknown as Redis;
    const worker = createNotificationDispatcherWorker(conn);
    expect(worker.name).toBe(QUEUE_NAMES.NOTIFICATIONS);
    void worker.close();
  });

  it('worker name does not contain a colon', () => {
    const conn = new RedisMock() as unknown as Redis;
    const worker = createNotificationDispatcherWorker(conn);
    expect(worker.name).not.toContain(':');
    void worker.close();
  });
});
