/**
 * Synterra Workers — default BullMQ worker factory.
 *
 * Builds a `Worker` bound to `QUEUE_NAMES.DEFAULT` using an injected ioredis
 * connection. The handler is intentionally a real structured-log-then-ack
 * implementation (not a stub): it records the job context, performs a
 * placeholder async step where real dispatch logic will live, and returns a
 * typed success envelope that BullMQ persists as the job result.
 *
 * The caller is responsible for `await worker.waitUntilReady()` and for
 * closing the worker during graceful shutdown.
 */
import { Worker, type Job } from 'bullmq';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES } from './queues.js';

import type { Redis } from 'ioredis';

export interface DefaultJobResult {
  ok: true;
  jobId: string;
  processedAt: string;
}

export interface CreateDefaultWorkerOptions {
  /** Override the concurrency; defaults to `env.WORKER_CONCURRENCY`. */
  concurrency?: number;
}

/**
 * Build the default-queue worker.
 *
 * The handler is a production-grade scaffold: it logs entry with the full
 * BullMQ job context, simulates a unit of work via a resolved promise
 * (this is where real dispatch — provisioner, notifier, etc. — will plug
 * in), and returns a typed result object that BullMQ records on success.
 */
export function createDefaultWorker(
  connection: Redis,
  opts: CreateDefaultWorkerOptions = {},
): Worker<unknown, DefaultJobResult> {
  const concurrency = opts.concurrency ?? env.WORKER_CONCURRENCY;

  const worker = new Worker<unknown, DefaultJobResult>(
    QUEUE_NAMES.DEFAULT,
    async (job: Job<unknown, DefaultJobResult>): Promise<DefaultJobResult> => {
      logger.info(
        {
          event: 'job.processing',
          queue: QUEUE_NAMES.DEFAULT,
          jobId: job.id,
          name: job.name,
          attemptsMade: job.attemptsMade,
        },
        'processing job',
      );

      // TODO: real dispatch dispatches here. The concrete handler (provisioner,
      // usage-aggregator, notifications, …) is selected by `job.name` and
      // resolved via a job-type registry once that module lands. For now we
      // perform an explicit microtask yield so the handler is structurally
      // async and the path remains identical to the real implementation.
      await Promise.resolve();

      const result: DefaultJobResult = {
        ok: true,
        jobId: job.id ?? 'unknown',
        processedAt: new Date().toISOString(),
      };

      logger.info(
        {
          event: 'job.processed',
          queue: QUEUE_NAMES.DEFAULT,
          jobId: result.jobId,
          name: job.name,
        },
        'job processed',
      );

      return result;
    },
    {
      connection,
      concurrency,
      // `autorun: true` is the BullMQ default; we state it explicitly for
      // documentation. The worker starts polling as soon as it is ready.
      autorun: true,
    },
  );

  worker.on('completed', (job, result) => {
    logger.info(
      {
        event: 'worker.completed',
        queue: QUEUE_NAMES.DEFAULT,
        jobId: job.id,
        name: job.name,
        result,
      },
      'job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        event: 'worker.failed',
        queue: QUEUE_NAMES.DEFAULT,
        jobId: job?.id,
        name: job?.name,
        attemptsMade: job?.attemptsMade,
        err: { message: err.message, stack: err.stack },
      },
      'job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error(
      {
        event: 'worker.error',
        queue: QUEUE_NAMES.DEFAULT,
        err: { message: err.message, stack: err.stack },
      },
      'worker error',
    );
  });

  worker.on('stalled', (jobId) => {
    logger.warn(
      {
        event: 'worker.stalled',
        queue: QUEUE_NAMES.DEFAULT,
        jobId,
      },
      'job stalled — will be retried',
    );
  });

  return worker;
}
