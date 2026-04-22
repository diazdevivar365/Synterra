import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

import type { Workflow, WorkflowRun } from '@/lib/workflows';

interface ListResp<T> {
  items: T[];
  total: number;
}

export async function listWorkflows(
  workspaceId: string,
  opts: { enabledOnly?: boolean } = {},
): Promise<Workflow[]> {
  const q = new URLSearchParams();
  q.set('enabled_only', String(opts.enabledOnly ?? false));
  const data = await aquilaFetch<ListResp<Workflow>>(workspaceId, `/workflows?${q.toString()}`);
  return data?.items ?? [];
}

export async function getWorkflow(workspaceId: string, slug: string): Promise<Workflow | null> {
  return aquilaFetch<Workflow>(workspaceId, `/workflows/${slug}`);
}

export async function listWorkflowRuns(
  workspaceId: string,
  slug: string,
  limit = 50,
): Promise<WorkflowRun[]> {
  const data = await aquilaFetch<ListResp<WorkflowRun>>(
    workspaceId,
    `/workflows/${slug}/runs?limit=${limit}`,
  );
  return data?.items ?? [];
}

export async function getWorkflowRun(
  workspaceId: string,
  runId: string,
): Promise<WorkflowRun | null> {
  return aquilaFetch<WorkflowRun>(workspaceId, `/workflow-runs/${runId}`);
}
