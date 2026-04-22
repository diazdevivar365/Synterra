import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export type BriefHorizon = 'now' | '7d' | '30d' | 'quarter';
export type BriefImpact = 'low' | 'medium' | 'high';

export interface Recommendation {
  action: string;
  rationale: string;
  horizon: BriefHorizon;
  impact: BriefImpact;
  references: string[];
}

export interface StrategyBrief {
  brand_id: string;
  intent: string;
  situation_summary: string;
  key_insights: string[];
  competitive_stance: string;
  tensions: string[];
  opportunities: string[];
  risks: string[];
  recommendations: Recommendation[];
  references: string[];
  confidence: number;
}

export interface SignalCounts {
  brand: number;
  battlecards: number;
  pulse_items: number;
  recent_alerts: number;
  recent_runs: number;
  snapshot_deltas: number;
  prior_cases: number;
}

export interface BriefListItem {
  id: string;
  brand_id: string;
  intent: string;
  query: string | null;
  brief: StrategyBrief;
  /** Present on GET /brain/briefs/{id} (full row). Omitted on list endpoint. */
  signals_snapshot?: Record<string, unknown>;
  confidence: number | null;
  created_by: string | null;
  created_at: string;
}

interface BriefListResponse {
  items: BriefListItem[];
  total: number;
}

export async function listBriefs(
  workspaceId: string,
  opts: { brandId?: string; intent?: string; limit?: number } = {},
): Promise<BriefListItem[]> {
  const q = new URLSearchParams();
  if (opts.brandId) q.set('brand_id', opts.brandId);
  if (opts.intent) q.set('intent', opts.intent);
  q.set('limit', String(opts.limit ?? 30));

  const data = await aquilaFetch<BriefListResponse>(workspaceId, `/brain/briefs?${q.toString()}`);
  return data?.items ?? [];
}

export async function getBrief(
  workspaceId: string,
  briefId: string,
): Promise<BriefListItem | null> {
  return aquilaFetch<BriefListItem>(workspaceId, `/brain/briefs/${briefId}`);
}
