import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export const POLICY_TRIGGER_TYPES = [
  'change_event',
  'stale_brand',
  'new_discovery',
  'battlecard_updated',
  'weekly_digest',
  'research_run_finished',
  'cerebro_brief_generated',
  'brand_dream_consolidated',
  'reference_added',
  'toque_added',
  'workflow_run_finished',
  'alert_fired',
] as const;

export type PolicyTriggerType = (typeof POLICY_TRIGGER_TYPES)[number];

export interface EventPolicy {
  id: number;
  orgId: string;
  name: string;
  description: string | null;
  triggerType: PolicyTriggerType;
  conditions: Record<string, unknown>;
  workflowSlug: string;
  workflowInput: Record<string, unknown>;
  cooldownSeconds: number;
  maxFiresPerHour: number;
  maxChainDepth: number;
  enabled: boolean;
  lastFiredAt: string | null;
  fireCount: number;
  createdAt: string;
  createdBy: string | null;
}

export interface PolicyFire {
  id: number;
  policyId: number;
  eventId: string;
  brandId: string | null;
  workflowRunId: string | null;
  result:
    | 'enqueued'
    | 'skipped_cooldown'
    | 'skipped_rate'
    | 'skipped_cycle'
    | 'skipped_match'
    | 'failed';
  error: string | null;
  firedAt: string;
}

interface RawPolicy {
  id: number;
  org_id: string;
  name: string;
  description: string | null;
  trigger_type: PolicyTriggerType;
  conditions: Record<string, unknown>;
  workflow_slug: string;
  workflow_input: Record<string, unknown>;
  cooldown_seconds: number;
  max_fires_per_hour: number;
  max_chain_depth: number;
  enabled: boolean;
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
  created_by: string | null;
}

interface RawFire {
  id: number;
  policy_id: number;
  event_id: string;
  brand_id: string | null;
  workflow_run_id: string | null;
  result: PolicyFire['result'];
  error: string | null;
  fired_at: string;
}

function mapPolicy(r: RawPolicy): EventPolicy {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    description: r.description,
    triggerType: r.trigger_type,
    conditions: r.conditions,
    workflowSlug: r.workflow_slug,
    workflowInput: r.workflow_input,
    cooldownSeconds: r.cooldown_seconds,
    maxFiresPerHour: r.max_fires_per_hour,
    maxChainDepth: r.max_chain_depth,
    enabled: r.enabled,
    lastFiredAt: r.last_fired_at,
    fireCount: r.fire_count,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

function mapFire(r: RawFire): PolicyFire {
  return {
    id: r.id,
    policyId: r.policy_id,
    eventId: r.event_id,
    brandId: r.brand_id,
    workflowRunId: r.workflow_run_id,
    result: r.result,
    error: r.error,
    firedAt: r.fired_at,
  };
}

export async function getEventPolicies(workspaceId: string): Promise<EventPolicy[]> {
  const data = await aquilaFetch<{ policies: RawPolicy[]; total: number }>(
    workspaceId,
    '/event-policies',
  );
  return (data?.policies ?? []).map(mapPolicy);
}

export async function getEventPolicyFires(
  workspaceId: string,
  policyId: number,
  limit = 10,
): Promise<PolicyFire[]> {
  const data = await aquilaFetch<{ fires: RawFire[]; total: number }>(
    workspaceId,
    `/event-policies/${policyId}/fires?limit=${limit}`,
  );
  return (data?.fires ?? []).map(mapFire);
}
