import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface UsageSnapshot {
  period: string;
  llm_calls: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  research_runs: number;
  brands: number;
  events_total: number;
  by_provider?: Record<string, { calls: number; cost_usd: number }>;
}

export interface ResearchRunRow {
  run_id: string;
  status: string;
  depth: string;
  brand_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
  error?: string | null;
}

export interface AlertFireRow {
  id: number;
  rule_id: number;
  rule_name?: string;
  brand_id: string | null;
  trigger: string;
  fired_at: string;
  action_result?: string | null;
}

interface List<T> {
  items: T[];
  total?: number;
}

interface AquilaUsageWire {
  org_id?: string;
  plan?: string;
  period?: { label?: string; start?: string; end?: string };
  counters?: {
    brands_total?: number;
    brands_added?: number;
    research_runs?: { total?: number; succeeded?: number; failed?: number; running?: number };
    ig_scans?: number;
    battlecards?: number;
    alerts_fired?: number;
  };
  llm?: {
    total_calls?: number;
    tokens_in?: number;
    tokens_out?: number;
    cost_usd_est?: number;
    by_provider?: Record<
      string,
      { calls?: number; tokens_in?: number; tokens_out?: number; cost_usd?: number }
    >;
  };
}

export async function getWorkspaceUsage(
  workspaceId: string,
  period = 'current_month',
  orgSlug?: string,
): Promise<UsageSnapshot | null> {
  const path = orgSlug ? `/orgs/${orgSlug}/usage?period=${period}` : `/usage?period=${period}`;
  const wire = await aquilaFetch<AquilaUsageWire>(workspaceId, path);
  if (!wire) return null;
  const byProvider: Record<string, { calls: number; cost_usd: number }> = {};
  for (const [name, p] of Object.entries(wire.llm?.by_provider ?? {})) {
    byProvider[name] = { calls: p.calls ?? 0, cost_usd: p.cost_usd ?? 0 };
  }
  return {
    period: wire.period?.label ?? '',
    llm_calls: wire.llm?.total_calls ?? 0,
    tokens_in: wire.llm?.tokens_in ?? 0,
    tokens_out: wire.llm?.tokens_out ?? 0,
    cost_usd: wire.llm?.cost_usd_est ?? 0,
    research_runs: wire.counters?.research_runs?.total ?? 0,
    brands: wire.counters?.brands_total ?? 0,
    events_total: wire.counters?.alerts_fired ?? 0,
    by_provider: byProvider,
  };
}

export async function listRecentResearchRuns(
  workspaceId: string,
  limit = 20,
): Promise<ResearchRunRow[]> {
  const data = await aquilaFetch<List<ResearchRunRow>>(
    workspaceId,
    `/research/runs?limit=${limit}`,
  );
  return data?.items ?? [];
}

export async function listRecentAlertFires(
  workspaceId: string,
  limit = 10,
): Promise<AlertFireRow[]> {
  const data = await aquilaFetch<List<AlertFireRow>>(workspaceId, `/alerting/fires?limit=${limit}`);
  return data?.items ?? [];
}
