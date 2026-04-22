'use server';

import { and, eq } from 'drizzle-orm';

import { workspaceMembers, workspaces } from '@synterra/db';

import { aquilaFetch } from '@/lib/aquila-server';
import { getBrandsForWorkspace } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { StrategyBrief } from '@/lib/cerebro';

/**
 * OMI tool dispatchers. Each action takes raw command args (free-text brand
 * names) and resolves them against the workspace's brand list before hitting
 * Aquila. When a name can't be matched we still pass it as brand_id — Aquila
 * will 404 cleanly and we surface that to the user.
 */

export interface ToolResult<T = unknown> {
  ok: boolean;
  error?: string;
  kind?: string;
  data?: T;
  /** Canonical URL to see the full result in Synterra. */
  link?: string;
}

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

/** Fuzzy-resolve a free-text brand name against the workspace's brand list. */
async function resolveBrandId(workspaceId: string, raw: string): Promise<string> {
  const needle = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!needle) return raw;
  const { brands } = await getBrandsForWorkspace(workspaceId);
  // 1) Exact brand_id match
  const byId = brands.find((b) => b.id.toLowerCase() === needle);
  if (byId) return byId.id;
  // 2) Name normalized
  const byName = brands.find(
    (b) =>
      b.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') === needle,
  );
  if (byName) return byName.id;
  // 3) Contains (first hit wins)
  const byPartial = brands.find(
    (b) => b.id.toLowerCase().includes(needle) || b.name.toLowerCase().includes(needle),
  );
  if (byPartial) return byPartial.id;
  // 4) Give up — pass as-is so Aquila responds 404 clean
  return needle;
}

interface AnalyzeResp {
  brief_id: string;
  brief: StrategyBrief;
  signal_counts?: Record<string, number>;
}

export async function analyzeFromCommandAction(params: {
  workspaceSlug: string;
  rawTarget: string;
  query?: string;
}): Promise<ToolResult<AnalyzeResp>> {
  const ws = await resolveWorkspace(params.workspaceSlug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const brandId = await resolveBrandId(ws.id, params.rawTarget);
  const trimmedQuery = params.query?.trim();
  const query =
    trimmedQuery && trimmedQuery.length > 0
      ? trimmedQuery
      : `Resumen estratégico de ${params.rawTarget}.`;

  const res = await aquilaFetch<AnalyzeResp>(ws.id, '/brain/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand_id: brandId, intent: 'audit', query }),
  });
  if (!res) {
    return {
      ok: false,
      error: `Aquila no encontró la marca "${params.rawTarget}" o falló el request.`,
    };
  }

  return {
    ok: true,
    kind: 'analyze',
    data: res,
    link: `/${params.workspaceSlug}/cerebro/${res.brief_id}`,
  };
}

interface ResearchResp {
  run_id: string;
  status: string;
}

export async function investigateFromCommandAction(params: {
  workspaceSlug: string;
  rawTarget: string;
}): Promise<ToolResult<ResearchResp>> {
  const ws = await resolveWorkspace(params.workspaceSlug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const looksLikeUrl = /^https?:\/\//i.test(params.rawTarget) || params.rawTarget.includes('.');
  const brandId = looksLikeUrl ? params.rawTarget : await resolveBrandId(ws.id, params.rawTarget);

  const body: Record<string, unknown> = looksLikeUrl
    ? { url: params.rawTarget.trim(), depth: 'light' }
    : { brand_id: brandId, depth: 'light' };

  const res = await aquilaFetch<ResearchResp>(ws.id, '/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res) return { ok: false, error: 'Aquila rechazó el request de research' };

  return {
    ok: true,
    kind: 'investigate',
    data: res,
    link: `/${params.workspaceSlug}/research/${res.run_id}`,
  };
}

interface ClashResp {
  brand_a: string;
  brand_b: string;
  winner?: string;
  summary?: string;
  verdict?: string;
  [k: string]: unknown;
}

export async function compareFromCommandAction(params: {
  workspaceSlug: string;
  rawA: string;
  rawB: string;
}): Promise<ToolResult<ClashResp>> {
  const ws = await resolveWorkspace(params.workspaceSlug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const [brandA, brandB] = await Promise.all([
    resolveBrandId(ws.id, params.rawA),
    resolveBrandId(ws.id, params.rawB),
  ]);

  const res = await aquilaFetch<ClashResp>(ws.id, '/brand-clash/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand_a: brandA, brand_b: brandB }),
  });
  if (!res) return { ok: false, error: 'Aquila no pudo correr el clash' };

  return {
    ok: true,
    kind: 'compare',
    data: res,
    link: `/${params.workspaceSlug}/clash`,
  };
}

interface TwinsResp {
  items?: { brand_id: string; name?: string; similarity?: number }[];
  twins?: { brand_id: string; name?: string; similarity?: number }[];
}

export async function twinsFromCommandAction(params: {
  workspaceSlug: string;
  rawTarget: string;
}): Promise<ToolResult<TwinsResp>> {
  const ws = await resolveWorkspace(params.workspaceSlug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const brandId = await resolveBrandId(ws.id, params.rawTarget);
  const res = await aquilaFetch<TwinsResp>(ws.id, `/brands/${brandId}/dna-twins`);
  if (!res) return { ok: false, error: 'No hay DNA twins disponibles para esa marca.' };

  return {
    ok: true,
    kind: 'twins',
    data: res,
    link: `/${params.workspaceSlug}/brands/${brandId}`,
  };
}

interface NewsResp {
  items?: unknown[];
}

export async function newsFromCommandAction(params: {
  workspaceSlug: string;
  rawTarget?: string | undefined;
}): Promise<ToolResult<NewsResp>> {
  const ws = await resolveWorkspace(params.workspaceSlug);
  if (!ws) return { ok: false, error: 'workspace no encontrado' };

  const q = new URLSearchParams();
  if (params.rawTarget) {
    const brandId = await resolveBrandId(ws.id, params.rawTarget);
    q.set('brand_id', brandId);
  }
  q.set('limit', '10');

  const res = await aquilaFetch<NewsResp>(ws.id, `/insights/recent-changes?${q.toString()}`);
  if (!res) return { ok: false, error: 'No pude obtener novedades.' };

  return {
    ok: true,
    kind: 'news',
    data: res,
    link: `/${params.workspaceSlug}/pulse`,
  };
}
