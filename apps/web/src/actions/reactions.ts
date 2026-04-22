'use server';

import { and, eq } from 'drizzle-orm';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

async function resolveWorkspace(slug: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return null;
  return db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
}

export interface ReactionsAnalysis {
  summary?: string;
  sentiment?: string;
  crisis_signals?: string[];
  urgency_24h?: boolean;
  topic_clusters?: { name: string; count?: number }[];
  recommended_response?: string;
}

export interface ReactionsPost {
  source: string;
  title?: string;
  url?: string;
  author?: string;
  score?: number;
  created_at?: string;
}

export interface ReactionsScanResult {
  brand_id: string;
  search_query: string;
  raw_counts: Record<string, number>;
  total_mentions: number;
  fetched_at?: string;
  analysis: ReactionsAnalysis;
  sample_posts: ReactionsPost[];
}

export async function triggerReactionsScan(
  _prev: ReactionsScanResult | null,
  formData: FormData,
): Promise<ReactionsScanResult | null> {
  const slug = formData.get('workspace') as string;
  const brandId = formData.get('brand_id') as string;

  const ws = await resolveWorkspace(slug);
  if (!ws) return null;

  const result = await aquilaFetch<ReactionsScanResult>(
    ws.id,
    `/brands/${encodeURIComponent(brandId)}/reactions-scan`,
    { method: 'POST' },
  );

  return result ?? null;
}
