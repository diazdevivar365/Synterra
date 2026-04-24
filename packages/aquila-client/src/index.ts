// @synterra/aquila-client — typed HTTP client for the Aquila data plane.
//
// Contract: PLAN.md §E.1. The provisioner flow (createOrg, issueApiKey) uses a
// short-lived JWT obtained from /auth/issue-provisioner-token. Org-level calls
// (createResearchRun, listResearchRuns) use the per-org apiKey directly.

import type {
  ApiKey,
  BrandDna,
  CommandCenter,
  CommandCenterActivityItem,
  CommandCenterActivityType,
  CommandCenterPinnedBrand,
  CommandCenterRiskBrand,
  DnaTwin,
  KpiTrend,
  KpiTrendDirection,
  OrgUsage,
  Organization,
  Paginated,
  ResearchRun,
  UsageLlm,
  UsagePeriodLabel,
} from './types.js';

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
  /** Fetch a single research run by ID (includes result when completed). */
  getResearchRun(organizationId: string, runId: string): Promise<ResearchRun>;

  // -- Brand DNA & Intelligence (W12) --
  /** Get Brand DNA profile containing tech stack, fonts, colors, and industry. */
  getBrandDna(brandId: string): Promise<BrandDna>;
  /** Get AI-matched competitors / DNA twins for a brand. */
  getDnaTwins(brandId: string): Promise<Paginated<DnaTwin>>;
  /** Mark a DNA twin as excluded/irrelevant. */
  excludeDnaTwin(brandId: string, twinId: string): Promise<{ ok: boolean }>;

  // -- AQ-3 · usage metering --
  /** Aggregated usage counters for a given org + period. */
  getOrgUsage(orgSlug: string, period?: UsagePeriodLabel): Promise<OrgUsage>;

  // -- W13-1 · command center (portal home) --
  /** Unified dashboard payload: KPIs + daily brief + pinned + activity + risk. */
  getCommandCenter(): Promise<CommandCenter>;
}

interface AquilaUsageWire {
  org_id: string;
  plan: string;
  period: { label: UsagePeriodLabel; start: string; end: string };
  counters: {
    brands_total: number;
    brands_added: number;
    research_runs: { total: number; succeeded: number; failed: number; running: number };
    ig_scans: number;
    battlecards: number;
    scheduled_briefings_active: number;
    briefings_sent: number;
    alerts_fired: number;
    users_active: number;
  };
  llm: {
    total_calls: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd_est: number;
    by_provider: Record<
      string,
      { calls: number; tokens_in: number; tokens_out: number; cost_usd: number }
    >;
    source: UsageLlm['source'];
  };
  generated_at: string;
}

export interface KpiTrendWire {
  value: number;
  delta_pct: number | null;
  direction: KpiTrendDirection;
}

export interface CommandCenterPinnedBrandWire {
  brand_id: string;
  tagline: string | null;
  url: string | null;
  palette: readonly string[] | null;
  last_run_at: string | null;
  ig_followers: number | null;
  consistency: number | null;
}

export interface CommandCenterActivityItemWire {
  type: CommandCenterActivityType;
  brand_id: string;
  kind?: string;
  status?: string;
  ts: string | null;
}

export interface CommandCenterRiskBrandWire {
  brand_id: string;
  tagline: string | null;
  consistency: number | null;
  days_stale: number;
  reason: string;
}

export interface CommandCenterWire {
  generated_at: string;
  kpis: {
    brands_tracked: KpiTrendWire;
    changes_24h: KpiTrendWire;
    runs_7d: KpiTrendWire;
    risk_brands: KpiTrendWire;
  };
  daily_brief: string;
  pinned_brands: readonly CommandCenterPinnedBrandWire[];
  activity_feed: readonly CommandCenterActivityItemWire[];
  risk_radar: readonly CommandCenterRiskBrandWire[];
}

function toKpiTrend(wire: KpiTrendWire): KpiTrend {
  return { value: wire.value, deltaPct: wire.delta_pct, direction: wire.direction };
}

function toPinnedBrand(wire: CommandCenterPinnedBrandWire): CommandCenterPinnedBrand {
  return {
    brandId: wire.brand_id,
    tagline: wire.tagline,
    url: wire.url,
    palette: wire.palette ?? [],
    lastRunAt: wire.last_run_at,
    igFollowers: wire.ig_followers,
    consistency: wire.consistency,
  };
}

function toActivityItem(wire: CommandCenterActivityItemWire): CommandCenterActivityItem {
  const out: CommandCenterActivityItem = { type: wire.type, brandId: wire.brand_id, ts: wire.ts };
  if (wire.kind !== undefined) out.kind = wire.kind;
  if (wire.status !== undefined) out.status = wire.status;
  return out;
}

function toRiskBrand(wire: CommandCenterRiskBrandWire): CommandCenterRiskBrand {
  return {
    brandId: wire.brand_id,
    tagline: wire.tagline,
    consistency: wire.consistency,
    daysStale: wire.days_stale,
    reason: wire.reason,
  };
}

export function toCommandCenter(wire: CommandCenterWire): CommandCenter {
  return {
    generatedAt: wire.generated_at,
    kpis: {
      brandsTracked: toKpiTrend(wire.kpis.brands_tracked),
      changes24h: toKpiTrend(wire.kpis.changes_24h),
      runs7d: toKpiTrend(wire.kpis.runs_7d),
      riskBrands: toKpiTrend(wire.kpis.risk_brands),
    },
    dailyBrief: wire.daily_brief,
    pinnedBrands: wire.pinned_brands.map(toPinnedBrand),
    activityFeed: wire.activity_feed.map(toActivityItem),
    riskRadar: wire.risk_radar.map(toRiskBrand),
  };
}

function toOrgUsage(wire: AquilaUsageWire): OrgUsage {
  const byProvider: Record<string, UsageLlm['byProvider'][string]> = {};
  for (const [name, b] of Object.entries(wire.llm.by_provider)) {
    byProvider[name] = {
      calls: b.calls,
      tokensIn: b.tokens_in,
      tokensOut: b.tokens_out,
      costUsd: b.cost_usd,
    };
  }
  return {
    orgId: wire.org_id,
    plan: wire.plan,
    period: wire.period,
    counters: {
      brandsTotal: wire.counters.brands_total,
      brandsAdded: wire.counters.brands_added,
      researchRuns: wire.counters.research_runs,
      igScans: wire.counters.ig_scans,
      battlecards: wire.counters.battlecards,
      scheduledBriefingsActive: wire.counters.scheduled_briefings_active,
      briefingsSent: wire.counters.briefings_sent,
      alertsFired: wire.counters.alerts_fired,
      usersActive: wire.counters.users_active,
    },
    llm: {
      totalCalls: wire.llm.total_calls,
      tokensIn: wire.llm.tokens_in,
      tokensOut: wire.llm.tokens_out,
      costUsdEst: wire.llm.cost_usd_est,
      byProvider,
      source: wire.llm.source,
    },
    generatedAt: wire.generated_at,
  };
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
  const data = await fetchJson<{ access_token: string }>(
    `${baseUrl}/auth/issue-provisioner-token`,
    {
      method: 'POST',
      headers: { 'X-Aquila-Provisioner-Secret': provisionerSecret },
    },
  );
  return data.access_token;
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
      const data = await fetchJson<{ status: string }>(`${baseUrl}/healthz`, { method: 'GET' });
      return { ok: data.status === 'ok' };
    },

    async createOrg(input) {
      const secret = requireProvisionerSecret();
      const token = await getProvisionerToken(baseUrl, secret);
      const data = await fetchJson<{ slug: string; created_at: string }>(`${baseUrl}/orgs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug: input.slug, name: input.displayName }),
      });
      return {
        id: data.slug,
        slug: data.slug,
        externalId: input.externalId,
        createdAt: data.created_at,
      };
    },

    async issueApiKey(slug) {
      const secret = requireProvisionerSecret();
      const token = await getProvisionerToken(baseUrl, secret);
      const data = await fetchJson<{
        id: string;
        org_id: string;
        plaintext: string;
        created_at: string;
      }>(`${baseUrl}/orgs/${slug}/api-keys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'synterra-provisioner', environment: 'live', scopes: ['*'] }),
      });
      return {
        id: data.id,
        organizationId: data.org_id,
        lastFour: data.plaintext.slice(-4),
        createdAt: data.created_at,
        revokedAt: null,
        rawKey: data.plaintext,
      };
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

    async getResearchRun(organizationId, runId) {
      return fetchJson<ResearchRun>(`${baseUrl}/orgs/${organizationId}/research-runs/${runId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
      });
    },

    async getBrandDna(brandId) {
      return fetchJson<BrandDna>(`${baseUrl}/brands/${brandId}/dna`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
      });
    },

    async getDnaTwins(brandId) {
      return fetchJson<Paginated<DnaTwin>>(`${baseUrl}/brands/${brandId}/dna-twins`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
      });
    },

    async excludeDnaTwin(brandId, twinId) {
      return fetchJson<{ ok: boolean }>(`${baseUrl}/brands/${brandId}/dna-twins/exclude`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
        body: JSON.stringify({ twinId }),
      });
    },

    async getOrgUsage(slug, period = 'current_month') {
      const wire = await fetchJson<AquilaUsageWire>(
        `${baseUrl}/orgs/${slug}/usage?period=${period}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
        },
      );
      return toOrgUsage(wire);
    },

    async getCommandCenter() {
      const wire = await fetchJson<CommandCenterWire>(`${baseUrl}/portal/command-center`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
      });
      return toCommandCenter(wire);
    },
  };
}

export type {
  ApiKey,
  BrandDna,
  CommandCenter,
  CommandCenterActivityItem,
  CommandCenterActivityType,
  CommandCenterKpis,
  CommandCenterPinnedBrand,
  CommandCenterRiskBrand,
  DnaTwin,
  KpiTrend,
  KpiTrendDirection,
  OrgUsage,
  Organization,
  Paginated,
  ResearchRun,
  ResearchRunStatus,
  UsageCounters,
  UsageLlm,
  UsageLlmProviderBreakdown,
  UsagePeriod,
  UsagePeriodLabel,
  UsageResearchRuns,
} from './types.js';
