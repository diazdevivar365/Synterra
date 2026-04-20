/**
 * Provisioner worker unit tests.
 *
 * config.ts is mocked (hoisted) so the Zod env parser never sees real env
 * vars — the tests run without any external services.
 */
import { createDecipheriv } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

// Must be hoisted before any import that transitively imports config.ts
vi.mock('./config.js', () => ({
  env: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://localhost:6379',
    HEALTH_PORT: 3002,
    LOG_LEVEL: 'silent',
    SHUTDOWN_TIMEOUT_MS: 15_000,
    WORKER_CONCURRENCY: 5,
    DATABASE_URL: 'postgres://localhost:5432/test',
    AQUILA_BASE_URL: 'https://aquila.test.invalid',
    AQUILA_PROVISIONER_SECRET: 'test-provisioner-secret-1234',
    AQUILA_ENCRYPT_KEY: 'a'.repeat(64),
    RESEND_API_KEY: 're_test_xxx',
  },
}));

vi.mock('./logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { encryptSecret } from './provisioner.js';
import { QUEUE_NAMES } from './queues.js';

const TEST_HEX_KEY = 'a'.repeat(64);

describe('encryptSecret', () => {
  it('returns a Buffer with at least 29 bytes (12 iv + 16 tag + ≥1 ciphertext)', () => {
    const result = encryptSecret('my-api-key', TEST_HEX_KEY);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(28);
  });

  it('produces a different IV on every call (random nonce)', () => {
    const r1 = encryptSecret('key', TEST_HEX_KEY);
    const r2 = encryptSecret('key', TEST_HEX_KEY);
    expect(r1.subarray(0, 12).toString('hex')).not.toBe(r2.subarray(0, 12).toString('hex'));
  });

  it('round-trips: decrypted ciphertext matches original key', () => {
    const raw = 'ak_supersecretkey1234567890';
    const encrypted = encryptSecret(raw, TEST_HEX_KEY);

    const iv = encrypted.subarray(0, 12);
    const authTag = encrypted.subarray(12, 28);
    const ciphertext = encrypted.subarray(28);

    const key = Buffer.from(TEST_HEX_KEY, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8',
    );

    expect(decrypted).toBe(raw);
  });
});

describe('QUEUE_NAMES.PROVISION invariant', () => {
  it('does not contain a colon (BullMQ rejects those)', () => {
    expect(QUEUE_NAMES.PROVISION).not.toContain(':');
  });

  it('has the expected stable value', () => {
    expect(QUEUE_NAMES.PROVISION).toBe('synterra-workspace-provision');
  });
});
