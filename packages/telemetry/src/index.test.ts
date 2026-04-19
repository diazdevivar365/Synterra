import { describe, expect, it } from 'vitest';

import { initTelemetry, shutdownTelemetry } from './index.js';

describe('@synterra/telemetry', () => {
  it('returns a no-op handle when disabled', async () => {
    const handle = initTelemetry({
      serviceName: 'test',
      serviceVersion: '0.0.0',
      enabled: false,
    });
    expect(typeof handle.shutdown).toBe('function');
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it('shutdownTelemetry is a no-op when no SDK is active', async () => {
    await expect(shutdownTelemetry()).resolves.toBeUndefined();
  });
});
