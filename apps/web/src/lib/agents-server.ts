import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface AgentSummary {
  name: string;
  file_name: string;
  role: string;
  goal: string;
  llm: string;
  version: string;
  prompt_length: number;
}

export interface AgentDetail extends AgentSummary {
  prompt: string;
}

interface ListResp {
  items: AgentSummary[];
  total: number;
}

export async function listAgents(workspaceId: string): Promise<AgentSummary[]> {
  const data = await aquilaFetch<ListResp>(workspaceId, '/agents');
  return data?.items ?? [];
}

export async function getAgent(workspaceId: string, name: string): Promise<AgentDetail | null> {
  return aquilaFetch<AgentDetail>(workspaceId, `/agents/${encodeURIComponent(name)}`);
}
