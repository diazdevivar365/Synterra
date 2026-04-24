import { and, eq } from 'drizzle-orm';
import { Activity, ExternalLink, RefreshCw } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { refreshPulseAction } from '@/actions/pulse';
import { brandNameFromId } from '@/lib/brands';
import { db } from '@/lib/db';
import { getMarketPulse, type PulseItem } from '@/lib/pulse';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

function kindLabel(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function kindColor(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes('messaging') || k.includes('tone') || k.includes('tagline'))
    return 'text-accent bg-accent/10 border-accent/20';
  if (k.includes('visual') || k.includes('palette') || k.includes('logo'))
    return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
  if (k.includes('product') || k.includes('pricing'))
    return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  if (k.includes('social') || k.includes('instagram') || k.includes('twitter'))
    return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
  if (k.includes('tech') || k.includes('domain') || k.includes('stack'))
    return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
  return 'text-muted-fg bg-surface-elevated border-border';
}

function importanceTone(score: number): string {
  if (score >= 4) return 'text-red-400';
  if (score >= 3) return 'text-orange-400';
  if (score >= 2) return 'text-yellow-400';
  return 'text-muted-fg';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffH = (now - d.getTime()) / 3_600_000;
    if (diffH < 1) return `${Math.max(1, Math.round(diffH * 60))}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 24 * 7) return `${Math.round(diffH / 24)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso.slice(0, 10);
  }
}

function groupByDay(items: PulseItem[]): Map<string, PulseItem[]> {
  const map = new Map<string, PulseItem[]>();
  for (const it of items) {
    const iso = it.detectedAt ?? it.scoredAt;
    const day = iso ? iso.slice(0, 10) : 'unknown';
    const list = map.get(day) ?? [];
    list.push(it);
    map.set(day, list);
  }
  return map;
}

export default async function PulsePage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const ws = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, ctx.userId)))
    .then((r) => r[0] ?? null);
  if (!ws) redirect('/workspaces');

  const items = (await getMarketPulse(ws.id, { limit: 60, minImportance: 1 })) ?? [];
  const grouped = groupByDay(items);
  const days = [...grouped.keys()].sort().reverse();

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Activity className="text-accent h-6 w-6" />
        <div className="flex-1">
          <h1 className="text-fg text-xl font-semibold">Market Pulse</h1>
          <p className="text-muted-fg text-sm">
            AI-scored strategic movements across {ws.name} portfolio ·{' '}
            <span className="text-fg">{items.length}</span> events
          </p>
        </div>
        <form action={refreshPulseAction}>
          <input type="hidden" name="workspace" value={slug} />
          <button
            type="submit"
            className="bg-surface-elevated border-border hover:border-accent/60 inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs transition-colors"
            title="Force re-score of recent events"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="border-border flex min-h-[260px] items-center justify-center rounded-[8px] border">
          <div className="max-w-md text-center">
            <p className="text-muted-fg font-mono text-sm">
              No pulse events yet. Run brand research to detect changes, then hit Refresh to score.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map((day) => {
            const bucket = grouped.get(day) ?? [];
            return (
              <section key={day}>
                <header className="border-border mb-3 flex items-baseline gap-2 border-b pb-2">
                  <h2 className="text-fg text-sm font-semibold">
                    {day === 'unknown' ? 'Undated' : new Date(day).toLocaleDateString()}
                  </h2>
                  <span className="text-muted-fg font-mono text-[10px]">
                    {bucket.length} event{bucket.length !== 1 ? 's' : ''}
                  </span>
                </header>
                <ul className="space-y-3">
                  {bucket.map((it) => (
                    <li
                      key={it.id}
                      className="border-border bg-surface hover:border-accent/40 rounded-[8px] border p-4 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`font-mono text-xs ${importanceTone(it.importanceScore)}`}>
                          ★{it.importanceScore}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-baseline gap-2">
                            <span className="text-fg text-sm font-medium">
                              {brandNameFromId(it.brandId)}
                            </span>
                            <span
                              className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${kindColor(it.kind)}`}
                            >
                              {kindLabel(it.kind)}
                            </span>
                            <span className="text-muted-fg ml-auto font-mono text-[10px]">
                              {formatDate(it.detectedAt ?? it.scoredAt)}
                            </span>
                          </div>
                          <p className="text-fg text-sm">{it.title}</p>
                          {it.commentary && (
                            <p className="text-muted-fg mt-1 text-xs">{it.commentary}</p>
                          )}
                          {(it.beforeValue ?? it.afterValue) && (
                            <div className="text-muted-fg mt-2 flex gap-2 font-mono text-[10px]">
                              {it.beforeValue && (
                                <span className="line-through opacity-70">{it.beforeValue}</span>
                              )}
                              {it.afterValue && <span className="text-fg">→ {it.afterValue}</span>}
                            </div>
                          )}
                          {it.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {it.tags.slice(0, 6).map((t) => (
                                <span
                                  key={t}
                                  className="border-border text-muted-fg rounded border px-1.5 py-0.5 font-mono text-[9px]"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {it.palette.length > 0 && (
                            <div className="mt-2 flex gap-1">
                              {it.palette.slice(0, 6).map((hex) => (
                                <div
                                  key={hex}
                                  className="border-border/50 h-3 w-3 rounded-sm border"
                                  style={{ backgroundColor: hex }}
                                  title={hex}
                                />
                              ))}
                            </div>
                          )}
                          {it.url && (
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent mt-2 inline-flex items-center gap-1 font-mono text-[10px] hover:underline"
                            >
                              source <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
