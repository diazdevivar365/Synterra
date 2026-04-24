import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface ResearchSchedule {
  id: number;
  brandId: string;
  url: string;
  cadenceHours: number;
  depth: string;
  geo: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runsCount: number;
  updatedAt: string;
}

interface RawSchedule {
  id: number;
  brand_id: string;
  url: string;
  cadence_hours: number;
  depth: string;
  geo: string | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  runs_count: number;
  updated_at: string;
}

export async function getSchedules(workspaceId: string): Promise<ResearchSchedule[]> {
  const data = await aquilaFetch<{ items: RawSchedule[] }>(workspaceId, '/schedules');
  return (data?.items ?? []).map((s) => ({
    id: s.id,
    brandId: s.brand_id,
    url: s.url,
    cadenceHours: s.cadence_hours,
    depth: s.depth,
    geo: s.geo,
    enabled: s.enabled,
    lastRunAt: s.last_run_at,
    nextRunAt: s.next_run_at,
    runsCount: s.runs_count,
    updatedAt: s.updated_at,
  }));
}

export interface BrandChangeEvent {
  id: number;
  runId: string | null;
  kind: string;
  beforeValue: string | null;
  afterValue: string | null;
  detectedAt: string;
}

interface RawBrandChange {
  id: number;
  run_id: string | null;
  kind: string;
  before_value: string | null;
  after_value: string | null;
  detected_at: string;
}

export async function getScheduleChanges(
  workspaceId: string,
  brandId: string,
  limit = 5,
): Promise<BrandChangeEvent[]> {
  const data = await aquilaFetch<{ brand_id: string; events: RawBrandChange[] }>(
    workspaceId,
    `/schedules/changes/${encodeURIComponent(brandId)}?limit=${limit}`,
  );
  return (data?.events ?? []).map((e) => ({
    id: e.id,
    runId: e.run_id,
    kind: e.kind,
    beforeValue: e.before_value,
    afterValue: e.after_value,
    detectedAt: e.detected_at,
  }));
}
