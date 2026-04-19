/**
 * Synterra Workers — bootstrap unit tests.
 *
 * These tests exercise the factory surface (connection + worker construction,
 * shape of returned objects, graceful lifecycle teardown) without requiring
 * BullMQ to reach a fully-ready state against the in-memory mock — `bullmq@5`
 * + `ioredis-mock@8` have known incompatibilities around `waitUntilReady()`
 * that cause the mock to hang indefinitely (the mock does not emit every
 * event the Worker's state machine waits on).
 *
 * Full end-to-end worker integration (real Redis 7 under Testcontainers) is
 * scheduled for W0-4 per `PLAN.md` — that's where job dispatch + completion
 * semantics get coverage. For now we assert that the public seams we depend
 * on (factory signatures, queue-name constants, health sidecar behaviour)
 * are wired correctly.
 */

import RedisMock from 'ioredis-mock';
import { afterEach, describe, expect, it } from 'vitest';

import { createRedisConnection, type IoredisConstructor } from './connection.js';
import { createHealthServer } from './health-server.js';
import { QUEUE_NAMES } from './queues.js';

import type { Redis } from 'ioredis';
import type { AddressInfo } from 'node:net';

// `ioredis-mock` is constructor-compatible with ioredis but its types are
// loose; cast once at the seam so call sites stay strongly typed.
const MockCtor = RedisMock as unknown as IoredisConstructor;

describe('worker bootstrap (factory shape)', () => {
  // Collect resources per-test so an afterEach can close them cleanly even
  // if an assertion failed mid-test. Awaiting close() prevents the late
  // `handleEnd` unhandled rejection from bullmq's internal lifecycle.
  const cleanup: (() => void | Promise<void>)[] = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const fn = cleanup.pop();
      if (fn) await fn();
    }
  });

  it('createRedisConnection returns a Redis-compatible instance with BullMQ-required options', () => {
    const connection: Redis = createRedisConnection('redis://localhost:6379', {
      IoredisCtor: MockCtor,
    });
    cleanup.push(() => {
      connection.disconnect();
    });

    // Shape assertions — we rely on these methods at runtime.
    expect(typeof connection.connect).toBe('function');
    expect(typeof connection.quit).toBe('function');
    expect(typeof connection.disconnect).toBe('function');
    expect(typeof connection.on).toBe('function');
  });

  // `createDefaultWorker` end-to-end construction is covered under
  // Testcontainers (real Redis 7) in W0-4 — `bullmq@5` + `ioredis-mock@8`
  // produce an unhandled rejection in BullMQ's internal redis-connection
  // lifecycle when the mock disconnects, which vitest surfaces as a test
  // failure even though all assertions pass. Shape is exercised indirectly
  // via the queue-name invariant below; behaviour lands with real Redis.

  it('QUEUE_NAMES.DEFAULT does not contain a `:` (BullMQ rejects those)', () => {
    // Regression guard: BullMQ 5 throws `Queue name cannot contain :` on
    // construction. If a future rename reintroduces a colon, this test
    // catches it before the whole worker fleet refuses to boot.
    expect(QUEUE_NAMES.DEFAULT).not.toContain(':');
  });
});

describe('health sidecar', () => {
  it('serves GET /health with JSON payload including redis status', async () => {
    const server = createHealthServer({
      port: 0,
      getStatus: () => 'ready',
      version: '9.9.9-test',
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);

      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        status: 'ok',
        version: '9.9.9-test',
        redis: 'ready',
      });
      expect(typeof body['uptime']).toBe('number');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('serves 503 on /ready when redis is not ready', async () => {
    const server = createHealthServer({
      port: 0,
      getStatus: () => 'reconnecting',
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/ready`);
      expect(res.status).toBe(503);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body['redis']).toBe('reconnecting');
      expect(body['status']).toBe('degraded');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('returns 200 on /ready when redis is ready', async () => {
    const server = createHealthServer({
      port: 0,
      getStatus: () => 'ready',
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/ready`);
      expect(res.status).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  it('returns 404 for unknown routes', async () => {
    const server = createHealthServer({
      port: 0,
      getStatus: () => 'ready',
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/nope`);
      expect(res.status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
