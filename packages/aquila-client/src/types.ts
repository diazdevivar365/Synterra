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
