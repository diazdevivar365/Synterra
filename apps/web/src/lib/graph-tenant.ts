import { aquilaFetch } from '@/lib/aquila-server';

export interface TenantGraphNode {
  id: string;
  label: string;
  group: number;
}

export interface TenantGraphEdge {
  source: string;
  target: string;
  kind: string;
  shared?: string[];
}

export interface TenantGraph {
  nodes: TenantGraphNode[];
  edges: TenantGraphEdge[];
}

export async function getTenantGraph(workspaceId: string): Promise<TenantGraph | null> {
  const data = await aquilaFetch<{
    nodes: { id: string; label: string; group: number }[];
    edges: { source: string; target: string; kind: string; shared?: string[] }[];
  }>(workspaceId, '/graph/tenant');
  if (!data) return null;
  return { nodes: data.nodes, edges: data.edges };
}
