export interface Workflow {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  intent: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string | null;
  org_id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  state_snapshot: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
}

export const WORKFLOW_INTENTS: { value: string; label: string }[] = [
  { value: 'audit', label: 'Auditoría' },
  { value: 'pivot', label: 'Pivote' },
  { value: 'launch', label: 'Lanzamiento' },
  { value: 'crisis', label: 'Crisis' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'positioning', label: 'Posicionamiento' },
  { value: 'brand_voice', label: 'Brand voice' },
  { value: 'content', label: 'Contenido' },
  { value: 'naming', label: 'Naming' },
  { value: 'pitch', label: 'Pitch' },
  { value: 'research', label: 'Research' },
];
