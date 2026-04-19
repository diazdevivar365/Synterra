// Next.js instrumentation hook — runs once at server startup (Node runtime only).
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;

  const { initTelemetry } = await import('@synterra/telemetry');
  initTelemetry({
    serviceName: 'synterra-web',
    serviceVersion: process.env['npm_package_version'] ?? '0.0.0',
    // OTEL_EXPORTER_OTLP_ENDPOINT is the standard env var; if unset the SDK
    // defaults to http://localhost:4318 (fine for local dev).
    enabled: process.env.NODE_ENV !== 'test',
  });
}
