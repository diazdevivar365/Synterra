import { describe, expect, it, vi } from 'vitest';

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

import { env } from './config.js';

describe('env.RESEND_API_KEY', () => {
  it('is present in the env object', () => {
    expect(env.RESEND_API_KEY).toBe('re_test_xxx');
  });
});
