import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { brandNameFromId, getBrandsForWorkspace } from '@/lib/brands';
import { listBriefs, type BriefListItem } from '@/lib/cerebro';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { CerebroForm } from './_form';

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ brand?: string }>;
}

export default async function CerebroPage({ params, searchParams }: Props) {
  const [{ workspace: slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const [{ brands, fromSeed }, recentBriefs] = await Promise.all([
    getBrandsForWorkspace(ws.id),
    listBriefs(ws.id, { limit: 10 }),
  ]);

  const brandOptions = brands.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Cerebro</h1>
        <p className="text-muted-fg font-mono text-xs">
          Research + estrategia sobre señales reales. {brandOptions.length} marcas disponibles
          {fromSeed ? ' · (modo preview sin conexión a Aquila)' : ''}
        </p>
      </div>

      {brandOptions.length === 0 ? (
        <div className="border-border flex min-h-[200px] items-center justify-center rounded-[8px] border">
          <p className="text-muted-fg text-sm">
            No hay marcas en este workspace todavía. Agregá alguna desde <code>/brands</code>.
          </p>
        </div>
      ) : (
        <CerebroForm
          workspace={slug}
          brands={brandOptions}
          defaultBrandId={
            sp.brand && brandOptions.find((b) => b.id === sp.brand) ? sp.brand : undefined
          }
        />
      )}

      {recentBriefs.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-fg text-base font-semibold">Briefs recientes</h2>
            <span className="text-muted-fg font-mono text-xs">{recentBriefs.length}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recentBriefs.map((b) => (
              <BriefPreview key={b.id} brief={b} slug={slug} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BriefPreview({ brief, slug }: { brief: BriefListItem; slug: string }) {
  const pct = brief.confidence != null ? Math.round(brief.confidence * 100) : null;
  const summary = brief.brief.situation_summary;
  const when = new Date(brief.created_at).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <a
      href={`/${slug}/cerebro/${brief.id}`}
      className="border-border bg-surface hover:border-accent/40 block rounded-[8px] border p-4 transition-colors"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-fg text-sm font-semibold">{brandNameFromId(brief.brand_id)}</div>
          <div className="text-muted-fg font-mono text-[10px]">
            {brief.intent} · {when}
          </div>
        </div>
        {pct != null && (
          <span className="bg-surface-elevated text-fg rounded-[4px] px-2 py-0.5 font-mono text-[10px]">
            {pct}%
          </span>
        )}
      </div>
      <p className="text-muted-fg line-clamp-2 text-xs leading-relaxed">{summary}</p>
    </a>
  );
}
