// @synterra/telemetry — OpenTelemetry bootstrap for Synterra Node services.
//
// Wires OTLP HTTP trace export to Grafana Tempo. Auto-instrumentations are
// intentionally omitted: tsup-bundled ESM breaks require-hook patching, so
// spans are created manually at call sites. `enabled: false` is a no-op for
// hermetic tests.

import { context, trace, type SpanContext } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

export { trace, context, SpanStatusCode } from '@opentelemetry/api';

export interface InitTelemetryOptions {
  serviceName: string;
  serviceVersion: string;
  /** Defaults to OTEL_EXPORTER_OTLP_ENDPOINT env or http://localhost:4318 */
  otlpEndpoint?: string;
  /** When false, returns a no-op handle (tests + local dev without a collector). */
  enabled?: boolean;
}

export interface TelemetryHandle {
  shutdown: () => Promise<void>;
}

const NOOP: TelemetryHandle = { shutdown: () => Promise.resolve() };

let activeSdk: NodeSDK | null = null;

export function initTelemetry(options: InitTelemetryOptions): TelemetryHandle {
  const { enabled = true, serviceName, serviceVersion, otlpEndpoint } = options;

  if (!enabled) return NOOP;
  if (activeSdk) return { shutdown: () => shutdownTelemetry() };

  process.env['OTEL_SERVICE_NAME'] = serviceName;
  process.env['OTEL_SERVICE_VERSION'] = serviceVersion;

  const traceExporter = new OTLPTraceExporter(
    otlpEndpoint ? { url: `${otlpEndpoint}/v1/traces` } : undefined,
  );

  const sdk = new NodeSDK({ traceExporter });
  sdk.start();
  activeSdk = sdk;

  return { shutdown: () => shutdownTelemetry() };
}

export async function shutdownTelemetry(): Promise<void> {
  if (!activeSdk) return;
  const sdk = activeSdk;
  activeSdk = null;
  await sdk.shutdown();
}

/**
 * Pino mixin — injects traceId + spanId from the active OTel span into every
 * log record. Pass as `mixin` option when creating the pino instance.
 * Returns {} when no span is active so the fields are simply absent (no nulls).
 */
export function otelMixin(): Partial<Pick<SpanContext, 'traceId' | 'spanId'>> {
  const span = trace.getSpan(context.active());
  if (!span?.isRecording()) return {};
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
}
