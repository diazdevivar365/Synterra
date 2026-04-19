/**
 * Synterra API — per-request access logger.
 *
 * Emits one structured log line per HTTP request with:
 *   - method, path, status, durationMs
 *   - requestId (from request-id middleware — assume it ran first)
 *   - userAgent, ip
 *
 * Severity is chosen from the response status class:
 *   2xx/3xx → info, 4xx → warn, 5xx → error.
 */

import logger from '../logger.js';

import type { RequestIdVariables } from './request-id.js';
import type { MiddlewareHandler } from 'hono';

function clientIpFrom(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  return headers.get('x-real-ip') ?? undefined;
}

export const loggerMiddleware: MiddlewareHandler<{ Variables: RequestIdVariables }> = async (
  c,
  next,
) => {
  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;

  try {
    await next();
  } finally {
    const durationMs = Math.round((performance.now() - start) * 1000) / 1000;
    const status = c.res.status;
    const requestId = c.get('requestId');
    const userAgent = c.req.header('user-agent');
    const ip = clientIpFrom(c.req.raw.headers);

    const fields = {
      method,
      path,
      status,
      durationMs,
      requestId,
      userAgent,
      ip,
    };

    if (status >= 500) {
      logger.error(fields, 'request.completed');
    } else if (status >= 400) {
      logger.warn(fields, 'request.completed');
    } else {
      logger.info(fields, 'request.completed');
    }
  }
};
