import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

export interface Vulnerability {
  area: string;
  description: string;
  exploitability: 'high' | 'medium' | 'low';
}

export interface OffensiveMove {
  type: string;
  headline: string;
  rationale: string;
  risk: string;
  time_to_execute: string;
}

export interface ModelOutput {
  vulnerabilities?: Vulnerability[];
  offensive_moves?: OffensiveMove[];
  killer_insight?: string;
  error?: string;
}

export interface Synthesis {
  final_verdict: string;
  consensus_moves: string[];
  disputed_areas: string[];
  priority_action: string;
}

export interface ClashResult {
  attacker: string;
  defender: string;
  agreement: 'high' | 'partial' | 'low';
  overlap_ratio: number;
  gemini: ModelOutput;
  claude: ModelOutput;
  synthesis: Synthesis | null;
}

export async function runClash(
  workspaceId: string,
  brandA: string,
  brandB: string,
): Promise<ClashResult | null> {
  return aquilaFetch<ClashResult>(
    workspaceId,
    `/brand-clash/simulate?brand_a=${encodeURIComponent(brandA)}&brand_b=${encodeURIComponent(brandB)}`,
    { method: 'POST' },
  );
}
