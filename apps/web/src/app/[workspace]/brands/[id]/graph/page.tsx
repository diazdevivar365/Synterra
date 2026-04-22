import { and, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandNameFromId, getBrandById, getBrandGraph } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string; id: string }>;
}

function NodeGroup({
  label,
  items,
  nameKey,
  subKey,
}: {
  label: string;
  items: Record<string, unknown>[];
  nameKey: string;
  subKey?: string;
}) {
  if (!items.length) return null;
  return (
    <div className="border-border bg-surface rounded-[8px] border p-4">
      <h3 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
        {label} <span className="text-accent">{items.length}</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => {
          const nameRaw = item[nameKey] ?? item['name'] ?? item['brand_id'];
          const name = typeof nameRaw === 'string' ? nameRaw : '?';
          const subRaw = subKey ? item[subKey] : undefined;
          const sub = typeof subRaw === 'string' ? subRaw : '';
          return (
            <div
              key={i}
              className="border-border bg-surface-elevated rounded-[6px] border px-2.5 py-1"
            >
              <span className="text-fg text-xs font-medium">
                {nameKey === 'brand_id' ? brandNameFromId(name) : name}
              </span>
              {sub && <span className="text-muted-fg ml-1.5 font-mono text-[10px]">{sub}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function GraphPage({ params }: Props) {
  const { workspace: slug, id } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const [brandResult, graph] = await Promise.all([
    getBrandById(ws.id, id),
    getBrandGraph(ws.id, id),
  ]);
  if (!brandResult) notFound();

  const { brand, fromSeed } = brandResult;

  const totalNodes = graph
    ? graph.tech.length +
      graph.social.length +
      graph.tags.length +
      graph.industries.length +
      graph.products.length +
      graph.persons.length +
      graph.competitors.length +
      graph.domains.length
    : 0;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {fromSeed && (
        <div className="border-border bg-surface mb-6 rounded-[8px] border px-4 py-3">
          <p className="text-muted-fg font-mono text-xs">
            Connecting to intelligence engine — showing example data.
          </p>
        </div>
      )}

      <div className="mb-8">
        <Link
          href={`/${slug}/brands/${id}`}
          className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors duration-150"
        >
          <ArrowLeft className="h-3 w-3" />
          {brand.name}
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-fg text-2xl font-bold">Knowledge Graph</h1>
          {graph && <span className="text-muted-fg font-mono text-xs">{totalNodes} nodes</span>}
        </div>
      </div>

      {!graph ? (
        <div className="border-border flex min-h-[240px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg font-mono text-sm">
            Brand not in graph yet — run a research scan to populate.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-accent/30 bg-surface rounded-[8px] border p-4">
            <p className="text-accent mb-1 font-mono text-[10px] uppercase tracking-wider">
              Brand node
            </p>
            <p className="text-fg text-lg font-bold">{brand.name}</p>
            {typeof graph.brand['url'] === 'string' && (
              <p className="text-muted-fg font-mono text-xs">{graph.brand['url']}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <NodeGroup label="Tech Stack" items={graph.tech} nameKey="name" subKey="version" />
            <NodeGroup label="Tags" items={graph.tags} nameKey="name" />
            <NodeGroup label="Industries" items={graph.industries} nameKey="name" />
            <NodeGroup
              label="Social Accounts"
              items={graph.social}
              nameKey="platform"
              subKey="handle"
            />
            <NodeGroup label="Competitors" items={graph.competitors} nameKey="brand_id" />
            <NodeGroup label="Products" items={graph.products} nameKey="name" />
            <NodeGroup label="People" items={graph.persons} nameKey="name" subKey="role" />
            <NodeGroup label="Domains" items={graph.domains} nameKey="url" />
          </div>
        </div>
      )}
    </div>
  );
}
