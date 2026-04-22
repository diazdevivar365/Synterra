/**
 * Synterra API — Prometheus metrics middleware + /metrics route helper.
 *
 * Records request rate, duration, and in-flight counts keyed by method,
 * matched route pattern (c.req.routePath, so we don't blow up the label
 * cardinality with raw URLs), and status class (2xx, 4xx, 5xx).
 *
 * Names match the Grafana dashboard `synterra-apps-health.json`:
 *   - http_requests_total{job, status_class}         — Counter
 *   - http_request_duration_seconds_bucket{job, le}  — Histogram
 *   - http_requests_in_flight{job}                   — Gauge
 *
 * The `job` label is emitted in the registry's static labels so
 * Prometheus can pin metrics to a specific service without per-request
 * cost. We set it when we import, then expose register.metrics() on
 * GET /metrics.
 */
import { matchedRoutes } from 'hono/route';
import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from 'prom-client';

import type { MiddlewareHandler } from 'hono';

// Pin static labels once. Matches Prometheus scrape job `synterra-api`.
register.setDefaultLabels({ job: 'synterra-api' });

// Default node.js metrics (process_*, nodejs_*) feed the apps-health
// "Process health" row. Safe to call here — register is module-singleton.
collectDefaultMetrics({ register });

const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests served, by method, route, and status class (2xx/4xx/5xx).',
  labelNames: ['method', 'route', 'status_class'] as const,
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_class'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'HTTP requests currently being processed.',
  labelNames: ['method'] as const,
  registers: [register],
});

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  return 'other';
}

export const metricsMiddleware: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  httpInFlight.inc({ method });
  const started = process.hrtime.bigint();

  try {
    await next();
  } finally {
    httpInFlight.dec({ method });

    // matchedRoutes gives us the route pattern (e.g. "/v1/brands/:id") with
    // parameters unsubstituted, so we avoid blowing up label cardinality on
    // dynamic IDs. Fall back to the raw path for unmatched 404s.
    const matched = matchedRoutes(c).at(-1)?.path;
    const route = matched ?? c.req.path;
    const sClass = statusClass(c.res.status);
    const elapsedNs = Number(process.hrtime.bigint() - started);
    const elapsedS = elapsedNs / 1e9;

    httpRequests.inc({ method, route, status_class: sClass });
    httpRequestDuration.observe({ method, route, status_class: sClass }, elapsedS);
  }
};

/**
 * GET /metrics handler — Prometheus scrape target. Returns the raw
 * text format from the shared register.
 */
export const metricsHandler: MiddlewareHandler = async (c) => {
  const body = await register.metrics();
  return c.text(body, 200, { 'Content-Type': register.contentType });
};
