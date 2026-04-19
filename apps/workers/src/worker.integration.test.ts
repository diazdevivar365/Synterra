// BullMQ worker integration test — real Redis 7 via Testcontainers.
//
// Requires Docker. Run explicitly with:
//   pnpm --filter @synterra/workers vitest run worker.integration
//
// Deferred from W0-1 because bullmq@5 + ioredis-mock@8 produce an unhandled
// rejection in BullMQ's internal lifecycle. Real Redis has no such issue.

import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createRedisConnection } from './connection.js';
import { QUEUE_NAMES } from './queues.js';
import { createDefaultWorker } from './worker.js';

import type { AddressInfo } from 'node:net';

describe('BullMQ worker — real Redis 7', { timeout: 120_000 }, () => {
  let container: StartedRedisContainer;
  let redisUrl: string;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7.4-alpine').withStartupTimeout(90_000).start();
    redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
  });

  afterAll(async () => {
    await container.stop();
  });

  it('processes a job and returns a typed result', async () => {
    const workerConn = createRedisConnection(redisUrl);
    await workerConn.connect();

    // BullMQ requires separate connections per Queue, Worker, and QueueEvents.
    const queueConn = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    const eventsConn = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    const queue = new Queue(QUEUE_NAMES.DEFAULT, { connection: queueConn });
    const queueEvents = new QueueEvents(QUEUE_NAMES.DEFAULT, { connection: eventsConn });
    const worker = createDefaultWorker(workerConn, { concurrency: 1 });

    try {
      await worker.waitUntilReady();

      const job = await queue.add('smoke-test', { hello: 'world' });
      const result = await job.waitUntilFinished(queueEvents, 10_000);

      expect(result).toMatchObject({
        ok: true,
        jobId: job.id,
      });
      expect(typeof result.processedAt).toBe('string');
    } finally {
      await worker.close();
      await queueEvents.close();
      await queue.close();
      await eventsConn.quit();
      await queueConn.quit();
      await workerConn.quit();
    }
  });

  it('exposes /metrics endpoint with prom-client default metrics', async () => {
    const { createHealthServer } = await import('./health-server.js');

    const server = createHealthServer({
      port: 0,
      getStatus: () => 'ready',
      version: '0.0.0-test',
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/metrics`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/plain/);

      const body = await res.text();
      // prom-client default metrics always include process_cpu_seconds_total
      expect(body).toMatch(/process_cpu_seconds_total/);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });
});
