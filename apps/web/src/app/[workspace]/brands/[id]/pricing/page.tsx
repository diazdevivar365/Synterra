import { and, eq } from 'drizzle-orm';
import { RefreshCw, Tag } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { syncPricing } from '@/actions/pricing';
import { brandNameFromId, getBrandPricing } from '@/lib/brands';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function BrandPricingPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
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

  const pricing = await getBrandPricing(ws.id, id);
  const brandName = brandNameFromId(id);

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-6 py-8">
      <div>
        <Link
          href={`/${slug}/brands/${id}`}
          className="text-muted-fg hover:text-fg mb-4 inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
        >
          ← {brandName}
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Tag className="text-accent h-5 w-5" />
            <h1 className="text-fg text-xl font-semibold">Pricing</h1>
          </div>
          <form action={syncPricing}>
            <input type="hidden" name="workspace" value={slug} />
            <input type="hidden" name="brand_id" value={id} />
            <button
              type="submit"
              className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync pricing
            </button>
          </form>
        </div>
        {pricing?.analyzed_at && (
          <p className="text-muted-fg mt-1 text-xs">
            Last synced {new Date(pricing.analyzed_at).toLocaleDateString()}
            {pricing.source_url && (
              <>
                {' · '}
                <span className="font-mono">{pricing.source_url}</span>
              </>
            )}
          </p>
        )}
      </div>

      {!pricing?.has_pricing ? (
        <div className="border-border rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-fg text-sm">No pricing data yet.</p>
          <p className="text-muted-fg mt-1 text-xs">
            Click &ldquo;Sync pricing&rdquo; to scrape and analyze pricing pages.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pricing.currency && (
            <p className="text-muted-fg text-xs">
              Currency: <span className="text-fg font-semibold">{pricing.currency}</span>
              {pricing.billing_period && (
                <>
                  {' · '}Billing:{' '}
                  <span className="text-fg font-semibold">{pricing.billing_period}</span>
                </>
              )}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pricing.plans.map((plan, i) => (
              <div
                key={i}
                className="bg-surface-elevated border-border space-y-3 rounded-lg border p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-fg text-sm font-semibold">{plan.name}</h2>
                  <div className="shrink-0 text-right">
                    {plan.price === null ? (
                      <span className="text-muted-fg text-xs">Contact sales</span>
                    ) : plan.price === 0 ? (
                      <span className="text-accent text-sm font-semibold">Free</span>
                    ) : (
                      <span className="text-fg text-sm font-semibold">
                        {pricing.currency ?? '$'}
                        {plan.price}
                        {plan.billing_period && (
                          <span className="text-muted-fg text-xs font-normal">
                            /{plan.billing_period}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {plan.features.length > 0 && (
                  <ul className="space-y-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="text-muted-fg flex gap-2 text-xs">
                        <span className="text-accent shrink-0">·</span> {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
