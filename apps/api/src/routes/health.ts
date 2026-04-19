/**
 * Synterra API — liveness / readiness endpoint.
 *
 * Returns `{ status, version, uptime }` with `Cache-Control: no-store` so
 * load balancers and probes always see the live value.
 */
import { Hono } from 'hono';

import type { RequestIdVariables } from '../middleware/request-id.js';

export interface HealthResponse {
  status: 'ok';
  version: string;
  uptime: number;
}

export function createHealthRouter(): Hono<{ Variables: RequestIdVariables }> {
  const router = new Hono<{ Variables: RequestIdVariables }>();

  router.get('/', (c) => {
    const body: HealthResponse = {
      status: 'ok',
      version: process.env['npm_package_version'] ?? '0.0.0',
      uptime: process.uptime(),
    };
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return c.json(body, 200);
  });

  return router;
}
