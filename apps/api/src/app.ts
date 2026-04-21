/**
 * Synterra API — Hono application factory.
 *
 * `buildApp()` returns a fully wired Hono instance WITHOUT binding a
 * network listener, which lets Vitest exercise routes via
 * `app.request(...)` at zero cost.
 *
 * Middleware order is deliberate:
 *   1. request-id  → every downstream log carries a correlation ID
 *   2. logger      → wraps the request so status/duration are accurate
 *   3. secure-headers → applied to every response
 */
import { Hono } from 'hono';

import { env } from './config.js';
import logger from './logger.js';
import { loggerMiddleware } from './middleware/logger.js';
import { requestIdMiddleware, type RequestIdVariables } from './middleware/request-id.js';
import { secureHeadersMiddleware } from './middleware/secure-headers.js';
import { createHealthRouter } from './routes/health.js';
import { createBrandsRouter } from './routes/v1/brands.js';
import { createChangesRouter } from './routes/v1/changes.js';
import { createGdprRouter } from './routes/v1/gdpr.js';

export interface AppEnv {
  Variables: RequestIdVariables;
}

export function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestIdMiddleware);
  app.use('*', loggerMiddleware);
  app.use('*', secureHeadersMiddleware());

  app.route('/v1/health', createHealthRouter());
  app.route('/v1/brands', createBrandsRouter());
  app.route('/v1/changes', createChangesRouter());
  app.route('/v1', createGdprRouter());

  app.notFound((c) => {
    return c.json({ error: 'not_found' }, 404);
  });

  app.onError((err, c) => {
    const requestId = c.get('requestId');
    logger.error(
      {
        requestId,
        path: c.req.path,
        method: c.req.method,
        err: {
          name: err.name,
          message: err.message,
          // Stack is always logged server-side; never leaked to the client.
          stack: err.stack,
        },
      },
      'request.unhandled_error',
    );

    const body =
      env.NODE_ENV === 'production'
        ? { error: 'internal_error' }
        : { error: 'internal_error', message: err.message };

    return c.json(body, 500);
  });

  return app;
}
