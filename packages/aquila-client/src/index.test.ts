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

  it('rejects missing baseUrl', () => {
    expect(() => createAquilaClient({ ...baseConfig, baseUrl: '' })).toThrow(/baseUrl/);
  });

  it('rejects missing apiKey/orgSlug when provisionerSecret is absent', () => {
    const { provisionerSecret: _p, ...noSecret } = baseConfig;
    expect(() => createAquilaClient({ ...noSecret, apiKey: '' })).toThrow(/apiKey/);
    expect(() => createAquilaClient({ ...noSecret, orgSlug: '' })).toThrow(/orgSlug/);
  });

  it('allows empty apiKey/orgSlug when provisionerSecret is set', () => {
    expect(() => createAquilaClient({ ...baseConfig, apiKey: '', orgSlug: '' })).not.toThrow();
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
      '/auth/issue-provisioner-token': {
        status: 200,
        body: { access_token: 'prov-jwt-xyz' },
      },
      '/orgs/acme/api-keys': {
        status: 201,
        body: {
          id: 'key-1',
          org_id: 'org-1',
          plaintext: 'ak_fullabcd',
          created_at: '2026-01-01T00:00:00Z',
        },
      },
      '/orgs': {
        status: 201,
        body: {
          slug: 'acme',
          created_at: '2026-01-01T00:00:00Z',
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
    expect(provInit?.headers).toMatchObject({ 'X-Aquila-Provisioner-Secret': 'prov-secret-abc' });
  });

  it('issueApiKey() fetches provisioner token then POSTs /orgs/:slug/api-keys', async () => {
    const client = createAquilaClient(baseConfig);
    const key = await client.issueApiKey('acme');
    expect(key.rawKey).toBe('ak_fullabcd');
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

describe('@synterra/aquila-client — getCommandCenter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({
      '/portal/command-center': {
        status: 200,
        body: {
          generated_at: '2026-04-24T00:00:00Z',
          kpis: {
            brands_tracked: { value: 12, delta_pct: null, direction: 'flat' },
            changes_24h: { value: 3, delta_pct: 50.0, direction: 'up' },
            runs_7d: { value: 24, delta_pct: -10.0, direction: 'down' },
            risk_brands: { value: 2, delta_pct: null, direction: 'flat' },
          },
          daily_brief: 'Jornada activa. 3 changes en toteme + cult-gaia.',
          pinned_brands: [
            {
              brand_id: 'demo__toteme',
              tagline: 'TOTEME',
              url: 'https://toteme-studio.com/',
              palette: ['#000000', '#ffffff'],
              last_run_at: '2026-04-23T22:00:00Z',
              ig_followers: 1200000,
              consistency: 8,
            },
          ],
          activity_feed: [
            {
              type: 'change',
              brand_id: 'demo__toteme',
              kind: 'homepage_copy',
              ts: '2026-04-24T00:31:45Z',
            },
            {
              type: 'run_done',
              brand_id: 'demo__ganni',
              status: 'done',
              ts: '2026-04-23T23:50:00Z',
            },
          ],
          risk_radar: [
            {
              brand_id: 'demo__by-far',
              tagline: null,
              consistency: 3,
              days_stale: 45,
              reason: 'stale >30d',
            },
          ],
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps snake_case wire → camelCase domain and uses apiKey bearer', async () => {
    const client = createAquilaClient(baseConfig);
    const cc = await client.getCommandCenter();

    expect(cc.generatedAt).toBe('2026-04-24T00:00:00Z');
    expect(cc.kpis.brandsTracked).toEqual({ value: 12, deltaPct: null, direction: 'flat' });
    expect(cc.kpis.changes24h).toEqual({ value: 3, deltaPct: 50.0, direction: 'up' });
    expect(cc.kpis.runs7d.direction).toBe('down');
    expect(cc.kpis.riskBrands.value).toBe(2);
    expect(cc.dailyBrief).toMatch(/Jornada activa/);

    expect(cc.pinnedBrands).toHaveLength(1);
    expect(cc.pinnedBrands[0]).toEqual({
      brandId: 'demo__toteme',
      tagline: 'TOTEME',
      url: 'https://toteme-studio.com/',
      palette: ['#000000', '#ffffff'],
      lastRunAt: '2026-04-23T22:00:00Z',
      igFollowers: 1200000,
      consistency: 8,
    });

    expect(cc.activityFeed[0]).toMatchObject({
      type: 'change',
      brandId: 'demo__toteme',
      kind: 'homepage_copy',
    });
    expect(cc.activityFeed[1]).toMatchObject({ type: 'run_done', status: 'done' });

    expect(cc.riskRadar[0]).toEqual({
      brandId: 'demo__by-far',
      tagline: null,
      consistency: 3,
      daysStale: 45,
      reason: 'stale >30d',
    });

    const calls = fetchMock.mock.calls as unknown[][];
    const init = findCallInit(calls, (u) => u.includes('/portal/command-center'));
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer test-org-key',
      'X-Org-Slug': 'acme',
    });
  });

  it('defaults palette to empty array when wire payload is null', async () => {
    fetchMock = mockFetch({
      '/portal/command-center': {
        status: 200,
        body: {
          generated_at: '2026-04-24T00:00:00Z',
          kpis: {
            brands_tracked: { value: 0, delta_pct: null, direction: 'flat' },
            changes_24h: { value: 0, delta_pct: null, direction: 'flat' },
            runs_7d: { value: 0, delta_pct: null, direction: 'flat' },
            risk_brands: { value: 0, delta_pct: null, direction: 'flat' },
          },
          daily_brief: '',
          pinned_brands: [
            {
              brand_id: 'demo__x',
              tagline: null,
              url: null,
              palette: null,
              last_run_at: null,
              ig_followers: null,
              consistency: null,
            },
          ],
          activity_feed: [],
          risk_radar: [],
        },
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAquilaClient(baseConfig);
    const cc = await client.getCommandCenter();
    expect(cc.pinnedBrands[0]!.palette).toEqual([]);
  });
});
