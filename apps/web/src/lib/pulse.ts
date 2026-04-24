import { aquilaFetch } from '@/lib/aquila-server';

export interface PulseItem {
  id: number;
  brandId: string;
  kind: string;
  title: string;
  commentary: string | null;
  importanceScore: number;
  tags: string[];
  beforeValue: string | null;
  afterValue: string | null;
  url: string | null;
  palette: string[];
  detectedAt: string | null;
  scoredAt: string | null;
}

interface RawPulse {
  id: number;
  brand_id: string;
  kind: string;
  title: string;
  commentary: string | null;
  importance_score: number;
  tags?: string[] | null;
  before_value: string | null;
  after_value: string | null;
  url: string | null;
  palette?: string[] | null;
  detected_at: string | null;
  scored_at: string | null;
}

export async function getMarketPulse(
  workspaceId: string,
  opts: { limit?: number; minImportance?: number } = {},
): Promise<PulseItem[] | null> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? 30));
  params.set('min_importance', String(opts.minImportance ?? 1));
  const data = await aquilaFetch<{ items: RawPulse[] }>(
    workspaceId,
    `/portal/pulse?${params.toString()}`,
  );
  if (!data) return null;
  return data.items.map((r) => ({
    id: r.id,
    brandId: r.brand_id,
    kind: r.kind,
    title: r.title,
    commentary: r.commentary,
    importanceScore: r.importance_score,
    tags: Array.isArray(r.tags) ? r.tags : [],
    beforeValue: r.before_value,
    afterValue: r.after_value,
    url: r.url,
    palette: Array.isArray(r.palette) ? r.palette : [],
    detectedAt: r.detected_at,
    scoredAt: r.scored_at,
  }));
}

export async function refreshMarketPulse(workspaceId: string): Promise<number | null> {
  const data = await aquilaFetch<{ new_items: number }>(workspaceId, '/portal/pulse/refresh', {
    method: 'POST',
  });
  return data?.new_items ?? null;
}
