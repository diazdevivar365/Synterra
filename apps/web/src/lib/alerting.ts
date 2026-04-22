import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface AlertingRule {
  id: number;
  name: string;
  description: string | null;
  triggerType: string;
  conditions: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  enabled: boolean;
  lastFiredAt: string | null;
  fireCount: number;
  createdAt: string;
}

export interface AlertingTemplate {
  name: string;
  description: string;
  triggerType: string;
  conditions: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
}

export interface AlertingFire {
  id: number;
  ruleId: number;
  brandId: string | null;
  trigger: Record<string, unknown>;
  actionResult: Record<string, unknown> | null;
  error: string | null;
  firedAt: string;
}

interface RawRule {
  id: number;
  name: string;
  description: string | null;
  trigger_type: string;
  conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  enabled: boolean;
  last_fired_at: string | null;
  fire_count: number;
  created_at: string;
}

interface RawTemplate {
  name: string;
  description: string;
  trigger_type: string;
  conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
}

interface RawFire {
  id: number;
  rule_id: number;
  brand_id: string | null;
  trigger: Record<string, unknown>;
  action_result: Record<string, unknown> | null;
  error: string | null;
  fired_at: string;
}

function mapRule(r: RawRule): AlertingRule {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    triggerType: r.trigger_type,
    conditions: r.conditions,
    actionType: r.action_type,
    actionConfig: r.action_config,
    enabled: r.enabled,
    lastFiredAt: r.last_fired_at,
    fireCount: r.fire_count,
    createdAt: r.created_at,
  };
}

export async function getAlertingRules(workspaceId: string): Promise<AlertingRule[]> {
  const data = await aquilaFetch<{ rules: RawRule[]; total: number }>(
    workspaceId,
    '/alerting/rules',
  );
  return (data?.rules ?? []).map(mapRule);
}

export async function getAlertingTemplates(workspaceId: string): Promise<AlertingTemplate[]> {
  const data = await aquilaFetch<{ templates: RawTemplate[] }>(workspaceId, '/alerting/templates');
  return (data?.templates ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    triggerType: t.trigger_type,
    conditions: t.conditions,
    actionType: t.action_type,
    actionConfig: t.action_config,
  }));
}

export async function getAlertingFires(workspaceId: string): Promise<AlertingFire[]> {
  const data = await aquilaFetch<{ fires: RawFire[]; total: number }>(
    workspaceId,
    '/alerting/fires?limit=20',
  );
  return (data?.fires ?? []).map((f) => ({
    id: f.id,
    ruleId: f.rule_id,
    brandId: f.brand_id,
    trigger: f.trigger,
    actionResult: f.action_result,
    error: f.error,
    firedAt: f.fired_at,
  }));
}
