import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface InsightsSummary {
  brandsTracked: number;
  researchRunsTotal: number;
  researchRunsDone: number;
  changeEvents7d: number;
  strategicAlerts: number;
  lastRun: {
    runId: string;
    brandId: string;
    status: string;
    finishedAt: string | null;
  } | null;
}

export interface RecentChangeBrand {
  brandId: string;
  events: {
    kind: string;
    before: string;
    after: string;
    date: string;
  }[];
}

export interface RecentChanges {
  windowDays: number;
  totalEvents: number;
  byBrand: RecentChangeBrand[];
}

export async function getInsightsSummary(workspaceId: string): Promise<InsightsSummary | null> {
  const data = await aquilaFetch<{
    brands_tracked: number;
    research_runs_total: number;
    research_runs_done: number;
    change_events_7d: number;
    strategic_alerts: number;
    last_run: {
      run_id: string;
      brand_id: string;
      status: string;
      finished_at: string | null;
    } | null;
  }>(workspaceId, '/insights/summary');
  if (!data) return null;
  return {
    brandsTracked: data.brands_tracked,
    researchRunsTotal: data.research_runs_total,
    researchRunsDone: data.research_runs_done,
    changeEvents7d: data.change_events_7d,
    strategicAlerts: data.strategic_alerts,
    lastRun: data.last_run
      ? {
          runId: data.last_run.run_id,
          brandId: data.last_run.brand_id,
          status: data.last_run.status,
          finishedAt: data.last_run.finished_at,
        }
      : null,
  };
}

export async function getRecentChanges(workspaceId: string): Promise<RecentChanges | null> {
  const data = await aquilaFetch<{
    window_days: number;
    total_events: number;
    by_brand: {
      brand_id: string;
      events: { kind: string; before: string; after: string; date: string }[];
    }[];
  }>(workspaceId, '/insights/recent-changes?days=14');
  if (!data) return null;
  return {
    windowDays: data.window_days,
    totalEvents: data.total_events,
    byBrand: data.by_brand.map((b) => ({
      brandId: b.brand_id,
      events: b.events,
    })),
  };
}

export interface InsightsCluster {
  clusterId: number;
  size: number;
  members: string[];
  commonIndustries: string[];
  commonTones: string[];
}

export interface InsightsClusters {
  k: number;
  totalBrands: number;
  clusters: InsightsCluster[];
}

export interface IndustryGap {
  industry: string;
  brands: string[];
  tonesCovered: string[];
  dominantTech: string[];
}

export interface IndustryGaps {
  industriesWithCoverage: number;
  items: IndustryGap[];
}

export async function getInsightsClusters(workspaceId: string): Promise<InsightsClusters | null> {
  const data = await aquilaFetch<{
    k: number;
    total_brands: number;
    clusters: {
      cluster_id: number;
      size: number;
      members: string[];
      common_industries: string[];
      common_tones: string[];
    }[];
  }>(workspaceId, '/insights/clusters?k=3');
  if (!data) return null;
  return {
    k: data.k,
    totalBrands: data.total_brands,
    clusters: data.clusters.map((c) => ({
      clusterId: c.cluster_id,
      size: c.size,
      members: c.members,
      commonIndustries: c.common_industries,
      commonTones: c.common_tones,
    })),
  };
}

export async function getIndustryGaps(workspaceId: string): Promise<IndustryGaps | null> {
  const data = await aquilaFetch<{
    industries_with_coverage: number;
    items: {
      industry: string;
      brands: string[];
      tones_covered: string[];
      dominant_tech: string[];
    }[];
  }>(workspaceId, '/insights/industry-gaps?min_brands=2');
  if (!data) return null;
  return {
    industriesWithCoverage: data.industries_with_coverage,
    items: data.items.map((i) => ({
      industry: i.industry,
      brands: i.brands,
      tonesCovered: i.tones_covered,
      dominantTech: i.dominant_tech,
    })),
  };
}
