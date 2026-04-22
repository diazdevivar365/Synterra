import { and, eq } from 'drizzle-orm';
import { BookOpen } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getGlossaryTerms } from '@/lib/glossary';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ q?: string; domain?: string }>;
}

export default async function GlossaryPage({ params, searchParams }: Props) {
  const { workspace: slug } = await params;
  const { q, domain } = await searchParams;

  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const terms = await getGlossaryTerms(ws.id, { q, domain });
  const domains = Array.from(new Set(terms.map((t) => t.domain))).sort();
  const grouped = domains.map((d) => ({
    domain: d,
    terms: terms.filter((t) => t.domain === d),
  }));

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <BookOpen className="text-accent h-5 w-5" />
        <h1 className="text-fg text-xl font-semibold">Glossary</h1>
        {terms.length > 0 && (
          <span className="bg-surface-elevated border-border rounded-full border px-2 py-0.5 font-mono text-[10px]">
            {terms.length} terms
          </span>
        )}
      </div>

      <form method="GET" className="flex items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search terms…"
          className="bg-surface border-border text-fg placeholder:text-muted-fg focus:ring-accent/50 w-full max-w-xs rounded border px-3 py-1.5 text-xs focus:outline-none focus:ring-1"
        />
        {domains.length > 1 && (
          <select
            name="domain"
            defaultValue={domain ?? ''}
            className="bg-surface border-border text-fg rounded border px-2 py-1.5 text-xs"
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="bg-surface-elevated border-border hover:border-accent/60 rounded border px-3 py-1.5 text-xs transition-colors"
        >
          Search
        </button>
      </form>

      {terms.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-fg text-sm">No terms found.</p>
          <p className="text-muted-fg mt-1 text-xs">Run brand research to populate the glossary.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ domain: dom, terms: domTerms }) => (
            <div key={dom}>
              <h2 className="text-muted-fg mb-3 font-mono text-[10px] uppercase tracking-wider">
                {dom}
              </h2>
              <div className="space-y-2">
                {domTerms.map((t) => (
                  <div key={t.slug} className="border-border bg-surface rounded-[8px] border p-4">
                    <div className="mb-1 flex items-baseline gap-3">
                      <span className="text-fg text-sm font-semibold">{t.term}</span>
                      <span className="text-muted-fg font-mono text-[10px]">{t.slug}</span>
                    </div>
                    <p className="text-muted-fg text-xs">{t.definition}</p>
                    {t.synonyms.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.synonyms.map((s) => (
                          <span
                            key={s}
                            className="bg-surface-elevated border-border text-muted-fg rounded border px-1.5 py-0.5 font-mono text-[9px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {t.related_terms.length > 0 && (
                      <p className="text-muted-fg mt-1.5 font-mono text-[10px]">
                        Related: {t.related_terms.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
