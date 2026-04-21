/**
 * Synterra Workers — bootstrap entrypoint.
 *
 * Wires env → logger → redis → worker → health sidecar, then registers
 * signal handlers for graceful shutdown (SIGTERM/SIGINT). A hard-kill
 * timeout of `SHUTDOWN_TIMEOUT_MS` fires via `setTimeout(...).unref()` so a
 * stuck drain cannot keep the container alive forever.
 */
import { initTelemetry, shutdownTelemetry } from '@synterra/telemetry';

import { env } from './config.js';
import { createRedisConnection } from './connection.js';
import { createDigestWorker, registerDigestRepeatable } from './digest-worker.js';
import { createHealthServer } from './health-server.js';
import logger from './logger.js';
import { createProvisionerWorker } from './provisioner.js';
import { createStripeEventsWorker } from './stripe-worker.js';
import {
  createUsageAggregatorWorker,
  registerUsageAggregatorRepeatable,
} from './usage-aggregator.js';
import { createWebhookDispatcherWorker } from './webhook-dispatcher-worker.js';
import { createDefaultWorker } from './worker.js';

async function main(): Promise<void> {
  initTelemetry({
    serviceName: 'synterra-workers',
    serviceVersion: process.env['npm_package_version'] ?? '0.0.0',
    enabled: env.NODE_ENV !== 'test',
  });

  logger.info({ event: 'worker.booting', nodeEnv: env.NODE_ENV }, 'worker booting');

  const connection = createRedisConnection(env.REDIS_URL);
  await connection.connect();

  const worker = createDefaultWorker(connection);
  await worker.waitUntilReady();

  const provisioner = createProvisionerWorker(connection);
  await provisioner.waitUntilReady();

  const stripeWorker = createStripeEventsWorker(connection);
  await stripeWorker.waitUntilReady();

  const usageAggregator = createUsageAggregatorWorker(connection);
  await usageAggregator.waitUntilReady();
  const usageAggregatorQueue = await registerUsageAggregatorRepeatable(connection);

  const digestWorker = createDigestWorker(connection);
  await digestWorker.waitUntilReady();
  const digestQueue = await registerDigestRepeatable(connection);

  const webhookDispatcher = createWebhookDispatcherWorker(connection);
  await webhookDispatcher.waitUntilReady();

  const healthServer = createHealthServer({
    port: env.HEALTH_PORT,
    getStatus: () => connection.status,
  });
  healthServer.listen(env.HEALTH_PORT);

  logger.info(
    { event: 'worker.ready', healthPort: env.HEALTH_PORT, concurrency: env.WORKER_CONCURRENCY },
    'worker ready',
  );

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals | 'fatal'): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ event: 'worker.draining', signal }, 'worker draining');

    const hardKill = setTimeout(() => {
      logger.fatal(
        { event: 'worker.shutdown.timeout', timeoutMs: env.SHUTDOWN_TIMEOUT_MS },
        'graceful shutdown timed out — forcing exit',
      );
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    hardKill.unref();

    try {
      await worker.close();
      await provisioner.close();
      await stripeWorker.close();
      await usageAggregator.close();
      await usageAggregatorQueue.close();
      await digestWorker.close();
      await digestQueue.close();
      await webhookDispatcher.close();
      await new Promise<void>((resolve, reject) => {
        healthServer.close((err) => (err ? reject(err) : resolve()));
      });
      await connection.quit();
      await shutdownTelemetry();
      logger.info({ event: 'worker.shutdown.complete' }, 'shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error(
        { event: 'worker.shutdown.error', err: { message: (err as Error).message } },
        'error during shutdown',
      );
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal(
      { event: 'worker.uncaughtException', err: { message: err.message, stack: err.stack } },
      'uncaught exception',
    );
    void shutdown('fatal');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ event: 'worker.unhandledRejection', reason }, 'unhandled rejection');
    void shutdown('fatal');
  });
}

main().catch((err: unknown) => {
  const e = err instanceof Error ? err : new Error(String(err));
  logger.fatal(
    { event: 'worker.boot.error', err: { message: e.message, stack: e.stack } },
    'worker failed to boot',
  );
  process.exit(1);
});
