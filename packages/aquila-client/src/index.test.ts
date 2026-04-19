import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAquilaClient,
  SUPPORTED_CONTRACT_VERSION,
  type AquilaClientConfig,
} from './index.js';

const baseConfig: AquilaClientConfig = {
  baseUrl: 'https://aquila.test.invalid',
  apiKey: 'test-org-key',
  orgSlug: 'acme',
  contractVersion: SUPPORTED_CONTRACT_VERSION,
  provisionerSecret: 'prov-secret-abc',
};

function mockFetch(responses: Record<string, { status: number; body: unknown }>) {
  // Sort keys longest-first so specific patterns (/orgs/acme/api-keys) beat
  // shorter prefixes (/orgs) during the linear scan.
  const keys = Object.keys(responses).sort((a, b) => b.length - a.length);
  return vi.fn((url: string) => {
    const match = keys.find((k) => url.includes(k));
    const res = match ? responses[match] : { status: 404, body: 'not found' };
    return Promise.resolve({
      ok: res!.status >= 200 && res!.status < 300,
      status: res!.status,
      json: () => Promise.resolve(res!.body),
      text: () => Promise.resolve(JSON.stringify(res!.body)),
    });
  });
}

function findCallUrl(calls: unknown[][], predicate: (u: string) => boolean): string | undefined {
  return calls.find((c) => predicate(c[0] as string))?.[0] as string | undefined;
}
function findCallInit(
  calls: unknown[][],
  predicate: (u: string) => boolean,
): RequestInit | undefined {
  return calls.find((c) => predicate(c[0] as string))?.[1] as RequestInit | undefined;
}

describe('@synterra/aquila-client — factory guards', () => {
  it('rejects mismatched contract versions at factory time', () => {
    expect(() =>
      createAquilaClient({
        ...baseConfig,
        // @ts-expect-error — intentional contract mismatch for the test.
        contractVersion: '1999-01',
      }),
    ).toThrow(/unsupported contractVersion/);
  });

  it('rejects missing required config fields', () => {
    expect(() => createAquilaClient({ ...baseConfig, baseUrl: '' })).toThrow(/baseUrl/);
    expect(() => createAquilaClient({ ...baseConfig, apiKey: '' })).toThrow(/apiKey/);
    expect(() => createAquilaClient({ ...baseConfig, orgSlug: '' })).toThrow(/orgSlug/);
  });

  it('rejects createOrg when provisionerSecret is absent', async () => {
    const { provisionerSecret: _p, ...noSecret } = baseConfig;
    const client = createAquilaClient(noSecret);
    await expect(
      client.createOrg({ slug: 's', externalId: 'e', displayName: 'd' }),
    ).rejects.toThrow(/provisionerSecret/);
  });

  it('rejects issueApiKey when provisionerSecret is absent', async () => {
    const { provisionerSecret: _p, ...noSecret } = baseConfig;
    const client = createAquilaClient(noSecret);
    await expect(client.issueApiKey('acme')).rejects.toThrow(/provisionerSecret/);
  });
});

describe('@synterra/aquila-client — HTTP calls', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({
      '/health': { status: 200, body: { status: 'ok' } },
      '/auth/issue-provisioner-token': { status: 200, body: { token: 'prov-jwt-xyz' } },
      '/orgs/acme/api-keys': {
        status: 201,
        body: {
          id: 'key-1',
          organizationId: 'org-1',
          lastFour: 'abcd',
          rawKey: 'ak_fullkey',
          createdAt: '2026-01-01T00:00:00Z',
          revokedAt: null,
        },
      },
      '/orgs': {
        status: 201,
        body: {
          id: 'org-1',
          slug: 'acme',
          externalId: 'ws-uuid',
          createdAt: '2026-01-01T00:00:00Z',
        },
      },
      '/research-runs': {
        status: 201,
        body: {
          id: 'run-1',
          organizationId: 'org-1',
          query: 'test',
          status: 'queued',
          createdAt: '2026-01-01T00:00:00Z',
          completedAt: null,
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('health() calls /health and returns ok:true', async () => {
    const client = createAquilaClient(baseConfig);
    const result = await client.health();
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/health'), expect.anything());
  });

  it('createOrg() fetches provisioner token then POSTs /orgs', async () => {
    const client = createAquilaClient(baseConfig);
    const org = await client.createOrg({
      slug: 'acme',
      externalId: 'ws-uuid',
      displayName: 'Acme',
    });
    expect(org.slug).toBe('acme');

    const calls = fetchMock.mock.calls as unknown[][];
    const urls = calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('/auth/issue-provisioner-token'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/orgs'))).toBe(true);

    const provInit = findCallInit(calls, (u) => u.includes('/auth/issue-provisioner-token'));
    expect(provInit?.headers).toMatchObject({ 'X-Provisioner-Secret': 'prov-secret-abc' });
  });

  it('issueApiKey() fetches provisioner token then POSTs /orgs/:slug/api-keys', async () => {
    const client = createAquilaClient(baseConfig);
    const key = await client.issueApiKey('acme');
    expect(key.rawKey).toBe('ak_fullkey');
    expect(key.lastFour).toBe('abcd');

    const calls = fetchMock.mock.calls as unknown[][];
    const urls = calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('/auth/issue-provisioner-token'))).toBe(true);
    expect(urls.some((u) => u.includes('/orgs/acme/api-keys'))).toBe(true);

    const keyInit = findCallInit(calls, (u) => u.includes('/api-keys'));
    expect(keyInit?.headers).toMatchObject({ Authorization: 'Bearer prov-jwt-xyz' });
  });

  it('createResearchRun() uses per-org apiKey bearer token', async () => {
    const client = createAquilaClient(baseConfig);
    const run = await client.createResearchRun('org-1', { query: 'test' });
    expect(run.status).toBe('queued');

    const calls = fetchMock.mock.calls as unknown[][];
    const runInit = findCallInit(calls, (u) => u.includes('/research-runs'));
    expect(runInit?.headers).toMatchObject({
      Authorization: 'Bearer test-org-key',
      'X-Org-Slug': 'acme',
    });
  });

  it('listResearchRuns() passes cursor + limit as query params', async () => {
    const client = createAquilaClient(baseConfig);
    await client.listResearchRuns('org-1', { cursor: 'tok-abc', limit: 20 });

    const calls = fetchMock.mock.calls as unknown[][];
    const runUrl = findCallUrl(calls, (u) => u.includes('/research-runs'));
    expect(runUrl).toContain('cursor=tok-abc');
    expect(runUrl).toContain('limit=20');
  });
});
