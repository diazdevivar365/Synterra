// Shared types describing Aquila entities that flow across the control/data
// plane boundary. Deliberately loose — tightened in W2-2 once the Aquila
// OpenAPI spec lands.

/**
 * Aquila-side organisation, 1:1 with a Synterra workspace. Linked by
 * `externalId` (the Synterra workspace id) so the data plane never sees
 * the control plane's primary key.
 */
export interface Organization {
  id: string;
  slug: string;
  externalId: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  organizationId: string;
  /** Last four chars of the raw key — full value is write-once. */
  lastFour: string;
  createdAt: string;
  revokedAt: string | null;
}

export type ResearchRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ResearchRun {
  id: string;
  organizationId: string;
  query: string;
  status: ResearchRunStatus;
  createdAt: string;
  completedAt: string | null;
  result?: unknown;
}

/** Envelope for list endpoints — matches Aquila's pagination convention. */
export interface Paginated<T> {
  items: readonly T[];
  nextCursor: string | null;
}

export interface BrandDna {
  brandId: string;
  techStack: readonly string[];
  fontSignature: string | null;
  industry: string | null;
  paletteSignature: readonly string[];
  updatedAt: string;
}

export interface DnaTwin {
  id: string;
  brandId: string;
  twinBrandId: string;
  twinBrandName: string;
  twinDomain: string;
  cosineScore: number;
  tone: string;
  positioningPreview: string;
  isExcluded: boolean;
}

// ─── AQ-3 · usage ──────────────────────────────────────────────────────────

export type UsagePeriodLabel = 'current_month' | 'last_30d' | 'last_7d' | 'last_24h';

export interface UsagePeriod {
  label: UsagePeriodLabel;
  start: string;
  end: string;
}

export interface UsageResearchRuns {
  total: number;
  succeeded: number;
  failed: number;
  running: number;
}

export interface UsageCounters {
  brandsTotal: number;
  brandsAdded: number;
  researchRuns: UsageResearchRuns;
  igScans: number;
  battlecards: number;
  scheduledBriefingsActive: number;
  briefingsSent: number;
  alertsFired: number;
  usersActive: number;
}

export interface UsageLlmProviderBreakdown {
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface UsageLlm {
  totalCalls: number;
  tokensIn: number;
  tokensOut: number;
  costUsdEst: number;
  byProvider: Readonly<Record<string, UsageLlmProviderBreakdown>>;
  source: 'usage_events' | 'pending';
}

export interface OrgUsage {
  orgId: string;
  plan: string;
  period: UsagePeriod;
  counters: UsageCounters;
  llm: UsageLlm;
  generatedAt: string;
}
