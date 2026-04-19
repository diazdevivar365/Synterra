/**
 * Synterra API — process entrypoint.
 *
 * Boots the Hono app on `@hono/node-server` and wires graceful shutdown:
 *   - SIGTERM / SIGINT → drain in-flight requests, then exit(0)
 *   - uncaughtException / unhandledRejection → log fatal, drain, exit(1)
 *   - hard-kill fallback after SHUTDOWN_TIMEOUT_MS so we never hang forever
 */
import { serve } from '@hono/node-server';

import { initTelemetry } from '@synterra/telemetry';

import { buildApp } from './app.js';
import { env } from './config.js';
import logger from './logger.js';

initTelemetry({
  serviceName: 'synterra-api',
  serviceVersion: process.env['npm_package_version'] ?? '0.0.0',
  enabled: env.NODE_ENV !== 'test',
});

const app = buildApp();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port, pid: process.pid, env: env.NODE_ENV }, 'server.started');
});

let shuttingDown = false;

function shutdown(reason: string, exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ reason, timeoutMs: env.SHUTDOWN_TIMEOUT_MS }, 'server.draining');

  const hardKill = setTimeout(() => {
    logger.fatal({ reason }, 'server.shutdown_timeout');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  hardKill.unref();

  server.close((err) => {
    if (err) {
      logger.error({ err: { name: err.name, message: err.message } }, 'server.close_error');
      process.exit(1);
    }
    logger.info({ reason }, 'server.stopped');
    process.exit(exitCode);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));

process.on('uncaughtException', (err) => {
  logger.fatal(
    { err: { name: err.name, message: err.message, stack: err.stack } },
    'uncaughtException',
  );
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandledRejection');
  shutdown('unhandledRejection', 1);
});
