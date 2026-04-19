import { describe, expect, it } from 'vitest';

import {
  createAquilaClient,
  SUPPORTED_CONTRACT_VERSION,
  type AquilaClientConfig,
} from './index.js';

const baseConfig: AquilaClientConfig = {
  baseUrl: 'https://aquila.test.invalid',
  apiKey: 'test-key',
  orgSlug: 'acme',
  contractVersion: SUPPORTED_CONTRACT_VERSION,
};

describe('@synterra/aquila-client', () => {
  it('rejects mismatched contract versions at factory time', () => {
    expect(() =>
      createAquilaClient({
        ...baseConfig,
        // @ts-expect-error — intentional contract mismatch for the test.
        contractVersion: '1999-01',
      }),
    ).toThrow(/unsupported contractVersion/);
  });

  it('rejects missing config', () => {
    expect(() => createAquilaClient({ ...baseConfig, baseUrl: '' })).toThrow(/baseUrl/);
    expect(() => createAquilaClient({ ...baseConfig, apiKey: '' })).toThrow(/apiKey/);
    expect(() => createAquilaClient({ ...baseConfig, orgSlug: '' })).toThrow(/orgSlug/);
  });

  it('returns methods that reject with the not-yet-wired error', async () => {
    const client = createAquilaClient(baseConfig);
    await expect(client.health()).rejects.toThrow(/not yet wired/);
    await expect(
      client.createOrg({ slug: 's', externalId: 'e', displayName: 'd' }),
    ).rejects.toThrow(/not yet wired/);
    await expect(client.issueApiKey('org-1')).rejects.toThrow(/not yet wired/);
    await expect(client.createResearchRun('org-1', { query: 'q' })).rejects.toThrow(
      /not yet wired/,
    );
    await expect(client.listResearchRuns('org-1')).rejects.toThrow(/not yet wired/);
  });
});
