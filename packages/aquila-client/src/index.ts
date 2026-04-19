// @synterra/aquila-client — typed HTTP client for the Aquila data plane.
//
// Contract: PLAN.md §E.1 (the versioned HTTP surface). The wire-up for the
// real calls lands across AQ-1..AQ-3 (org provisioning, api-key issuance,
// research-run creation). Until then the factory validates config and all
// methods reject with a clear pointer.

import type { ApiKey, Organization, Paginated, ResearchRun } from './types.js';

export type AquilaContractVersion = '2026-04';
export const SUPPORTED_CONTRACT_VERSION: AquilaContractVersion = '2026-04';

export interface AquilaClientConfig {
  /** Aquila API base URL (e.g. `https://aquila.internal.forgentic.io`). */
  baseUrl: string;
  /** Service-to-service bearer token issued by Aquila admin plane. */
  apiKey: string;
  /** Synterra workspace slug acting on behalf of. Propagated as a header. */
  orgSlug: string;
  /** Contract pin — mismatch fails fast at factory time. */
  contractVersion: AquilaContractVersion;
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
  /** Mint a scoped API key for a given organisation (AQ-2). */
  issueApiKey(organizationId: string): Promise<ApiKey & { rawKey: string }>;
  /** Kick off a research run on the data plane (AQ-3). */
  createResearchRun(organizationId: string, input: CreateResearchRunInput): Promise<ResearchRun>;
  /** Paginated listing of research runs for a given organisation. */
  listResearchRuns(
    organizationId: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<Paginated<ResearchRun>>;
}

const NOT_WIRED = 'aquila-client not yet wired — see W2-2 + AQ-1..AQ-3';

/**
 * Build a typed Aquila client. The factory validates config eagerly —
 * mismatched contract versions throw here, not on first call, so a bad
 * deploy surfaces in startup logs instead of half-way through a request.
 */
export function createAquilaClient(config: AquilaClientConfig): AquilaClient {
  // Runtime guard against callers casting their way past the type system
  // (JS consumers, config loaded from JSON, etc.). The cast to `string`
  // silences `no-unnecessary-condition` — the type narrows to the literal,
  // but at runtime any value is possible.
  const received = config.contractVersion as string;
  if (received !== SUPPORTED_CONTRACT_VERSION) {
    throw new Error(
      `aquila-client: unsupported contractVersion "${received}" — expected "${SUPPORTED_CONTRACT_VERSION}"`,
    );
  }
  if (!config.baseUrl) throw new Error('aquila-client: baseUrl is required');
  if (!config.apiKey) throw new Error('aquila-client: apiKey is required');
  if (!config.orgSlug) throw new Error('aquila-client: orgSlug is required');

  // Rejected-promise factory (sync body — no `async` marker) so ESLint's
  // require-await rule is satisfied while still matching the `Promise<never>`
  // return contract the AquilaClient interface expects.
  const notWired = (): Promise<never> => Promise.reject(new Error(NOT_WIRED));

  return {
    health: notWired,
    createOrg: notWired,
    issueApiKey: notWired,
    createResearchRun: notWired,
    listResearchRuns: notWired,
  };
}

export type { ApiKey, Organization, Paginated, ResearchRun, ResearchRunStatus } from './types.js';
