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

export async function getWorkspaceUsage(
  workspaceId: string,
  period = 'current_month',
  orgSlug?: string,
): Promise<UsageSnapshot | null> {
  // Aquila usage endpoint is scoped by slug; caller supplies it via header.
  // If orgSlug not passed, fall back to /usage generic (may return null).
  const path = orgSlug ? `/orgs/${orgSlug}/usage?period=${period}` : `/usage?period=${period}`;
  return aquilaFetch<UsageSnapshot>(workspaceId, path);
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
