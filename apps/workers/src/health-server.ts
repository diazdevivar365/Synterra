/**
 * Synterra Workers — HTTP health sidecar.
 *
 * Kubernetes / ECS / Fargate need a way to distinguish "process alive" from
 * "process can actually do work". A lean zero-dependency `node:http` server
 * exposes:
 *
 *   GET /health — always 200 as long as the event loop turns. Returns a
 *                 JSON envelope with the upstream Redis status, so operators
 *                 can see the client state even when it is degraded.
 *   GET /ready  — 200 only when Redis is `ready`; 503 otherwise. This is the
 *                 signal a load balancer / scheduler should key on.
 *   otherwise   — 404 text/plain.
 *
 * The server is intentionally dependency-free (no Hono, no Express). The
 * Redis status is injected via `getStatus()` so the sidecar never reaches
 * into global state.
 */
import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { collectDefaultMetrics, register } from 'prom-client';

import logger from './logger.js';

// Collect default Node.js process metrics (event loop lag, heap, GC, etc.)
collectDefaultMetrics({ register });

/**
 * Redis client statuses we surface on /health. The `'ready'` state is the
 * only one that flips /ready to 200; everything else reports 503.
 *
 * We keep the set open-ended with `string` because ioredis exposes a handful
 * of additional intermediate states we want to forward verbatim rather than
 * normalise.
 */
export type RedisStatus =
  | 'ready'
  | 'connecting'
  | 'connect'
  | 'reconnecting'
  | 'end'
  | 'close'
  | 'wait'
  | 'unknown'
  | (string & {});

export interface HealthServerOptions {
  /** Port to bind. Pass `0` for an ephemeral port (tests). */
  port: number;
  /** Returns the current ioredis client status. Called on every request. */
  getStatus: () => RedisStatus;
  /** Service version, surfaced in the /health body. Defaults to env var. */
  version?: string;
}

export interface HealthPayload {
  status: 'ok' | 'degraded';
  version: string;
  uptime: number;
  redis: RedisStatus;
}

function buildPayload(getStatus: () => RedisStatus, version: string): HealthPayload {
  const redis = getStatus();
  return {
    status: redis === 'ready' ? 'ok' : 'degraded',
    version,
    uptime: process.uptime(),
    redis,
  };
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload).toString(),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function writeNotFound(res: ServerResponse): void {
  const body = 'Not Found';
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body).toString(),
  });
  res.end(body);
}

/**
 * Build the health sidecar. Returns an unstarted `http.Server` — the caller
 * performs `.listen()` and retains the instance for graceful shutdown.
 */
export function createHealthServer({ port, getStatus, version }: HealthServerOptions): Server {
  const resolvedVersion = version ?? process.env['npm_package_version'] ?? '0.0.0';

  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    // Only GET is meaningful. Reject others with 405 so operators can see
    // misconfigured probes in logs rather than silently 404.
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      res.end();
      return;
    }

    const url = req.url ?? '/';

    if (url === '/health' || url.startsWith('/health?')) {
      writeJson(res, 200, buildPayload(getStatus, resolvedVersion));
      return;
    }

    if (url === '/ready' || url.startsWith('/ready?')) {
      const payload = buildPayload(getStatus, resolvedVersion);
      writeJson(res, payload.redis === 'ready' ? 200 : 503, payload);
      return;
    }

    if (url === '/metrics' || url.startsWith('/metrics?')) {
      register
        .metrics()
        .then((metrics: string) => {
          res.writeHead(200, { 'Content-Type': register.contentType });
          res.end(metrics);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ event: 'metrics.error', err: { message } }, 'metrics error');
          res.writeHead(500);
          res.end();
        });
      return;
    }

    writeNotFound(res);
  });

  server.on('error', (err) => {
    logger.error(
      { event: 'health.error', port, err: { message: err.message } },
      'health server error',
    );
  });

  // `port` and `bindPort` are stored on the caller; the sidecar itself is
  // unopinionated about when listen() is invoked so tests can bind to :0.
  server.on('listening', () => {
    logger.info({ event: 'health.listening', port }, 'health sidecar listening');
  });

  return server;
}
