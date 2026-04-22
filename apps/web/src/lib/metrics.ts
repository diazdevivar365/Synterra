import 'server-only';

import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

// Prom-client is Node-only; guard against double-registration during Next.js
// dev hot-reload which re-evaluates modules.
const g = globalThis as typeof globalThis & {
  __synterraWebMetricsBooted?: boolean;
};
if (!g.__synterraWebMetricsBooted) {
  register.setDefaultLabels({ job: 'synterra-web' });
  collectDefaultMetrics({ register });
  g.__synterraWebMetricsBooted = true;
}

export const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests served by Next.js app routes, by method and status class.',
  labelNames: ['method', 'route', 'status_class'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds for Next.js app routes.',
  labelNames: ['method', 'route', 'status_class'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export function statusClass(status: number): string {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500) return '5xx';
  return 'other';
}

export { register };
