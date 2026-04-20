// @synterra/aquila-client — typed HTTP client for the Aquila data plane.
//
// Contract: PLAN.md §E.1. The provisioner flow (createOrg, issueApiKey) uses a
// short-lived JWT obtained from /auth/issue-provisioner-token. Org-level calls
// (createResearchRun, listResearchRuns) use the per-org apiKey directly.

import type { ApiKey, Organization, Paginated, ResearchRun } from './types.js';

export type AquilaContractVersion = '2026-04';
export const SUPPORTED_CONTRACT_VERSION: AquilaContractVersion = '2026-04';

export interface AquilaClientConfig {
  /** Aquila API base URL (e.g. `https://aquila.internal.forgentic.io`). */
  baseUrl: string;
  /** Per-org bearer token used for research-run calls. */
  apiKey: string;
  /** Synterra workspace slug — propagated as `X-Org-Slug` header. */
  orgSlug: string;
  /** Contract pin — mismatch fails fast at factory time. */
  contractVersion: AquilaContractVersion;
  /** Provisioner secret (AQUILA_PROVISIONER_SECRET). Required for createOrg / issueApiKey. */
  provisionerSecret?: string;
}

export interface CreateOrgInput {
  slug: string;
  externalId: string;
  displayName: string;
}

export interface CreateResearchRunInput {
  query: string;
  /** Opaque metadata forwarded verbatim back on webhooks. */
  metadata?: Readonly<Record<string, string>>;
}

export interface AquilaClient {
  /** Liveness probe against Aquila's `/health` surface. */
  health(): Promise<{ ok: boolean }>;
  /** Provision an Aquila organisation mirroring a Synterra workspace (AQ-1). */
  createOrg(input: CreateOrgInput): Promise<Organization>;
  /** Mint a scoped API key for a given organisation slug (AQ-2). */
  issueApiKey(orgSlug: string): Promise<ApiKey & { rawKey: string }>;
  /** Kick off a research run on the data plane (AQ-3). */
  createResearchRun(organizationId: string, input: CreateResearchRunInput): Promise<ResearchRun>;
  /** Paginated listing of research runs for a given organisation. */
  listResearchRuns(
    organizationId: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<Paginated<ResearchRun>>;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`aquila-client: ${init.method ?? 'GET'} ${url} → HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function getProvisionerToken(baseUrl: string, provisionerSecret: string): Promise<string> {
  const data = await fetchJson<{ token: string }>(`${baseUrl}/auth/issue-provisioner-token`, {
    method: 'POST',
    headers: { 'X-Provisioner-Secret': provisionerSecret },
  });
  return data.token;
}

/**
 * Build a typed Aquila client. The factory validates config eagerly —
 * mismatched contract versions throw here, not on first call.
 */
export function createAquilaClient(config: AquilaClientConfig): AquilaClient {
  const received = config.contractVersion as string;
  if (received !== SUPPORTED_CONTRACT_VERSION) {
    throw new Error(
      `aquila-client: unsupported contractVersion "${received}" — expected "${SUPPORTED_CONTRACT_VERSION}"`,
    );
  }
  if (!config.baseUrl) throw new Error('aquila-client: baseUrl is required');
  // apiKey + orgSlug are only required for org-level calls; provisioner-only
  // clients set provisionerSecret and leave these empty.
  if (!config.provisionerSecret) {
    if (!config.apiKey) throw new Error('aquila-client: apiKey is required');
    if (!config.orgSlug) throw new Error('aquila-client: orgSlug is required');
  }

  const { baseUrl, apiKey, orgSlug, provisionerSecret } = config;

  function requireProvisionerSecret(): string {
    if (!provisionerSecret) {
      throw new Error('aquila-client: provisionerSecret is required for this operation');
    }
    return provisionerSecret;
  }

  return {
    async health() {
      const data = await fetchJson<{ status: string }>(`${baseUrl}/health`, { method: 'GET' });
      return { ok: data.status === 'ok' };
    },

    async createOrg(input) {
      const secret = requireProvisionerSecret();
      const token = await getProvisionerToken(baseUrl, secret);
      return fetchJson<Organization>(`${baseUrl}/orgs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      });
    },

    async issueApiKey(slug) {
      const secret = requireProvisionerSecret();
      const token = await getProvisionerToken(baseUrl, secret);
      return fetchJson<ApiKey & { rawKey: string }>(`${baseUrl}/orgs/${slug}/api-keys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
    },

    async createResearchRun(organizationId, input) {
      return fetchJson<ResearchRun>(`${baseUrl}/orgs/${organizationId}/research-runs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
        body: JSON.stringify(input),
      });
    },

    async listResearchRuns(organizationId, options) {
      const params = new URLSearchParams();
      if (options?.cursor) params.set('cursor', options.cursor);
      if (options?.limit !== undefined) params.set('limit', String(options.limit));
      const qs = params.size > 0 ? `?${params.toString()}` : '';
      return fetchJson<Paginated<ResearchRun>>(
        `${baseUrl}/orgs/${organizationId}/research-runs${qs}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
        },
      );
    },
  };
}

export type { ApiKey, Organization, Paginated, ResearchRun, ResearchRunStatus } from './types.js';
