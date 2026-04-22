import { and, eq } from 'drizzle-orm';
import { Download, Sword, Trash2 } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { generateBattlecard, deleteBattlecard } from '@/actions/battlecards';
import { type Battlecard, getBattlecardsForBrand } from '@/lib/battlecards';
import { type Brand, getBrandsForWorkspace } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function BattlecardsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;

  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const { brands } = await getBrandsForWorkspace(ws.id);

  const brandCards: { brand: Brand; cards: Battlecard[] }[] = await Promise.all(
    brands.map(async (b: Brand) => ({
      brand: b,
      cards: await getBattlecardsForBrand(ws.id, b.id),
    })),
  );

  const totalCards = brandCards.reduce(
    (s: number, b: { brand: Brand; cards: Battlecard[] }) => s + b.cards.length,
    0,
  );

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center gap-3">
        <Sword className="text-accent h-6 w-6" />
        <div>
          <h1 className="text-fg text-xl font-semibold">Battlecards</h1>
          <p className="text-muted-fg text-sm">
            {totalCards} card{totalCards !== 1 ? 's' : ''} across {brands.length} brand
            {brands.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Generate form */}
      <div className="bg-surface-elevated border-border space-y-4 rounded-lg border p-5">
        <h2 className="text-fg text-sm font-semibold">Generate New Battlecard</h2>
        <form action={generateBattlecard} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="workspace" value={slug} />

          <div className="flex flex-col gap-1">
            <label className="text-muted-fg text-xs">Your Brand</label>
            <select
              name="brand_id"
              required
              className="bg-surface border-border text-fg min-w-[160px] rounded border px-3 py-1.5 text-sm"
            >
              <option value="">Select brand…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted-fg text-xs">vs. Competitor</label>
            <select
              name="competitor_id"
              required
              className="bg-surface border-border text-fg min-w-[160px] rounded border px-3 py-1.5 text-sm"
            >
              <option value="">Select competitor…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-accent hover:bg-accent/90 rounded px-4 py-1.5 text-sm font-medium text-white"
          >
            Generate PDF
          </button>
        </form>
        <p className="text-muted-fg text-xs">
          Generation takes 5–15 seconds. Refresh after submitting.
        </p>
      </div>

      {/* Cards by brand */}
      {brandCards.map(({ brand, cards }) =>
        cards.length === 0 ? null : (
          <div key={brand.id} className="space-y-3">
            <h2 className="text-fg border-border border-b pb-2 text-sm font-semibold">
              {brand.name}
            </h2>
            <div className="space-y-2">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="bg-surface-elevated border-border flex items-start gap-4 rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-fg text-sm font-medium">vs. {card.competitorId}</span>
                      {card.competitorTagline && (
                        <span className="text-muted-fg truncate text-xs">
                          {card.competitorTagline}
                        </span>
                      )}
                      {card.regenCount > 0 && (
                        <span className="bg-surface text-muted-fg border-border rounded border px-1.5 py-0.5 text-[10px]">
                          v{card.regenCount + 1}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-fg line-clamp-2 text-xs">{card.summary}</p>
                    <div className="text-muted-fg mt-1 flex items-center gap-3 text-[10px]">
                      {card.generatedAt && (
                        <span>{new Date(card.generatedAt).toLocaleDateString()}</span>
                      )}
                      <span>{fmt(card.pdfSize)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/api/${slug}/battlecards/${encodeURIComponent(brand.id)}/${card.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-accent/10 text-accent hover:bg-accent/20 flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                    <form action={deleteBattlecard}>
                      <input type="hidden" name="workspace" value={slug} />
                      <input type="hidden" name="card_id" value={String(card.id)} />
                      <button
                        type="submit"
                        className="text-muted-fg hover:text-danger rounded p-1.5 transition-colors"
                        title="Delete battlecard"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      )}

      {totalCards === 0 && (
        <div className="text-muted-fg border-border rounded-lg border border-dashed py-16 text-center text-sm">
          No battlecards yet. Generate one above.
        </div>
      )}
    </div>
  );
}
