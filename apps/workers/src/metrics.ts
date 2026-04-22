/**
 * Synterra Workers — custom Prometheus metrics.
 *
 * prom-client default metrics (process_*, nodejs_*) are registered in
 * `health-server.ts`. This module adds business-level counters/gauges:
 *
 *   - bullmq_jobs_completed_total{queue}       — jobs that finished OK
 *   - bullmq_jobs_failed_total{queue}          — jobs that threw
 *   - bullmq_jobs_active                       — current active job count per queue
 *   - bullmq_waiting_jobs{queue}               — gauge sampled every 30s
 *   - bullmq_job_duration_seconds{queue}       — histogram of processing time
 *   - lago_reconcile_runs_total{result}        — success/failure of per-workspace
 *                                                Lago usage pull in usage-aggregator
 *   - stripe_webhook_events_total{event_type}  — Stripe events consumed by
 *                                                stripe-worker (keyed by Stripe
 *                                                event.type like
 *                                                `invoice.payment_succeeded`)
 *
 * Grafana dashboard `synterra-apps-health.json` reads these exact names —
 * rename here means updating the dashboard JSON.
 */
import { Counter, Gauge, Histogram, register } from 'prom-client';

import logger from './logger.js';

import type { Queue, Worker } from 'bullmq';

export const bullmqJobsCompleted = new Counter({
  name: 'bullmq_jobs_completed_total',
  help: 'BullMQ jobs that completed successfully, by queue.',
  labelNames: ['queue'] as const,
  registers: [register],
});

export const bullmqJobsFailed = new Counter({
  name: 'bullmq_jobs_failed_total',
  help: 'BullMQ jobs that threw on the processor, by queue.',
  labelNames: ['queue'] as const,
  registers: [register],
});

export const bullmqJobDuration = new Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'BullMQ job processing time (start → done/failed), by queue.',
  labelNames: ['queue', 'result'] as const,
  buckets: [0.1, 0.5, 1, 5, 15, 60, 300, 900],
  registers: [register],
});

export const bullmqWaitingJobs = new Gauge({
  name: 'bullmq_waiting_jobs',
  help: 'BullMQ queue depth (waiting state), sampled periodically.',
  labelNames: ['queue'] as const,
  registers: [register],
});

export const bullmqActiveJobs = new Gauge({
  name: 'bullmq_active_jobs',
  help: 'BullMQ jobs currently being processed, by queue.',
  labelNames: ['queue'] as const,
  registers: [register],
});

export const lagoReconcileRuns = new Counter({
  name: 'lago_reconcile_runs_total',
  help: 'Per-workspace Lago usage reconciliation outcomes.',
  labelNames: ['result'] as const, // success | failure
  registers: [register],
});

export const stripeWebhookEvents = new Counter({
  name: 'stripe_webhook_events_total',
  help: 'Stripe webhook events consumed by stripe-worker.',
  labelNames: ['event_type'] as const,
  registers: [register],
});

/**
 * Attach BullMQ lifecycle listeners that update the counters above. Safe to
 * call once per worker; subsequent calls would double-count so don't.
 *
 * Uses `processedOn`/`finishedOn` so duration reflects actual processor
 * time, not queue waiting time.
 */
export function instrumentWorker(queueName: string, worker: Worker): void {
  worker.on('active', () => {
    bullmqActiveJobs.inc({ queue: queueName });
  });

  worker.on('completed', (job) => {
    bullmqActiveJobs.dec({ queue: queueName });
    bullmqJobsCompleted.inc({ queue: queueName });
    if (job.processedOn && job.finishedOn) {
      const seconds = (job.finishedOn - job.processedOn) / 1000;
      bullmqJobDuration.observe({ queue: queueName, result: 'success' }, seconds);
    }
  });

  worker.on('failed', (job, err) => {
    bullmqActiveJobs.dec({ queue: queueName });
    bullmqJobsFailed.inc({ queue: queueName });
    if (job?.processedOn && job.finishedOn) {
      const seconds = (job.finishedOn - job.processedOn) / 1000;
      bullmqJobDuration.observe({ queue: queueName, result: 'failure' }, seconds);
    }
    logger.warn({ event: 'bullmq.job_failed', queue: queueName, err: err.message }, 'job failed');
  });
}

/**
 * Start a timer that periodically polls queue depth via `Queue.getJobCounts`
 * and updates the `bullmq_waiting_jobs` gauge. BullMQ events don't expose
 * waiting count directly, so polling is the standard pattern.
 *
 * Returns a `stop` fn the caller invokes during graceful shutdown.
 */
export function startQueueDepthSampler(
  queues: { name: string; queue: Queue }[],
  intervalMs = 30_000,
): () => void {
  const tick = async (): Promise<void> => {
    await Promise.all(
      queues.map(async ({ name, queue }) => {
        try {
          const counts = await queue.getJobCounts('waiting', 'delayed');
          const waiting = (counts['waiting'] ?? 0) + (counts['delayed'] ?? 0);
          bullmqWaitingJobs.set({ queue: name }, waiting);
        } catch (err) {
          // Don't let metrics errors crash the worker. Log once per tick.
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(
            { event: 'metrics.queue_depth.failed', queue: name, err: { message } },
            'queue depth sample failed',
          );
        }
      }),
    );
  };

  // Fire once immediately so Grafana isn't empty for the first 30s.
  void tick();
  const handle = setInterval(() => void tick(), intervalMs);
  handle.unref();

  return (): void => {
    clearInterval(handle);
  };
}
