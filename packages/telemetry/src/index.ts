// @synterra/telemetry — OpenTelemetry bootstrap for Synterra Node services.
//
// Wraps `@opentelemetry/sdk-node`. The full wire-up (HTTP OTLP trace exporter +
// `@opentelemetry/auto-instrumentations-node` covering node core HTTP + pino
// log bridge) lands alongside those deps in K-series work — see PLAN.md §K.1.
// For today the SDK starts with defaults so services can opt in without
// crashing, and `enabled: false` returns a no-op so tests stay hermetic.

import { NodeSDK } from '@opentelemetry/sdk-node';

export interface InitTelemetryOptions {
  /** Logical service name reported to the OTLP collector. */
  serviceName: string;
  /** Semver of the deployed service — surfaces in Grafana filters. */
  serviceVersion: string;
  /**
   * OTLP/HTTP collector endpoint. When omitted the SDK's own defaults apply
   * (`OTEL_EXPORTER_OTLP_ENDPOINT` env or `http://localhost:4318`).
   */
  otlpEndpoint?: string;
  /** When `false`, returns a no-op handle (useful for tests + local dev). */
  enabled?: boolean;
}

export interface TelemetryHandle {
  shutdown: () => Promise<void>;
}

const NOOP: TelemetryHandle = {
  shutdown: async () => {
    /* no-op */
  },
};

let activeSdk: NodeSDK | null = null;

/**
 * Initialise OpenTelemetry for the current Node process. Call as early as
 * possible — ideally in the process entrypoint before any app imports that
 * should be auto-instrumented. Idempotent: once an SDK is active, subsequent
 * calls return a handle that shuts down the existing SDK.
 */
export function initTelemetry(options: InitTelemetryOptions): TelemetryHandle {
  const { enabled = true, serviceName, serviceVersion, otlpEndpoint } = options;

  if (!enabled) return NOOP;

  if (activeSdk) {
    return { shutdown: () => shutdownTelemetry() };
  }

  // Propagate via the SDK's standard env contract — avoids hard-depending on
  // exporter/resource packages until the K-series lands.
  process.env['OTEL_SERVICE_NAME'] = serviceName;
  process.env['OTEL_SERVICE_VERSION'] = serviceVersion;
  if (otlpEndpoint) {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = otlpEndpoint;
  }

  // Instrumentations (pino bridge, node http, etc.) plug in here once
  // `@opentelemetry/auto-instrumentations-node` is added to deps — see
  // PLAN.md §K.1.
  const sdk = new NodeSDK({});
  sdk.start();
  activeSdk = sdk;

  return { shutdown: () => shutdownTelemetry() };
}

/**
 * Flush + stop the active SDK if one is running. Safe to call repeatedly.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!activeSdk) return;
  const sdk = activeSdk;
  activeSdk = null;
  await sdk.shutdown();
}
