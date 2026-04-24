import { and, eq } from 'drizzle-orm';
import { Trash2, Zap } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { createEventPolicy, deleteEventPolicy, togglePolicy } from '@/actions/event-policies';
import { db } from '@/lib/db';
import {
  POLICY_TRIGGER_TYPES,
  getEventPolicies,
  getEventPolicyFires,
  type PolicyFire,
} from '@/lib/event-policies';
import { listWorkflows } from '@/lib/workflows-server';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

function triggerLabel(t: string) {
  return t.replace(/_/g, ' ');
}

function resultClass(r: PolicyFire['result']) {
  if (r === 'enqueued') return 'bg-accent/10 text-accent';
  if (r === 'failed') return 'bg-danger/10 text-danger';
  return 'bg-surface-elevated text-muted-fg';
}

export default async function AutomationsPage({ params }: Props) {
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

  const [policies, workflows] = await Promise.all([
    getEventPolicies(ws.id),
    listWorkflows(ws.id, { enabledOnly: true }),
  ]);

  // Fetch fires for the first 3 enabled policies (keep the RTT count bounded).
  const topPolicies = policies.filter((p) => p.enabled).slice(0, 3);
  const firesByPolicy = new Map<number, PolicyFire[]>();
  await Promise.all(
    topPolicies.map(async (p) => {
      const fires = await getEventPolicyFires(ws.id, p.id, 5);
      firesByPolicy.set(p.id, fires);
    }),
  );

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Automations</h1>
        <p className="text-muted-fg font-mono text-xs">
          {policies.length} polic{policies.length === 1 ? 'y' : 'ies'} · event-driven workflow
          triggers (D4 flywheel)
        </p>
      </div>

      <div className="space-y-10">
        {/* Create form */}
        <section>
          <h2 className="text-fg mb-4 text-base font-semibold">New policy</h2>
          {workflows.length === 0 ? (
            <div className="border-border flex min-h-[100px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                Need ≥1 enabled workflow before creating a policy. Open Workflows first.
              </p>
            </div>
          ) : (
            <form
              action={createEventPolicy}
              className="border-border bg-surface grid gap-3 rounded-[8px] border p-5 md:grid-cols-2"
            >
              <input type="hidden" name="workspace" value={slug} />
              <input type="hidden" name="enabled" value="on" />

              <label className="flex flex-col gap-1">
                <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  Name
                </span>
                <input
                  type="text"
                  name="name"
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="Auto-refresh battlecard on positioning change"
                  className="border-border bg-surface-elevated text-fg focus:border-accent/60 rounded-[4px] border px-2 py-1.5 text-xs focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  Trigger type
                </span>
                <select
                  name="trigger_type"
                  required
                  className="border-border bg-surface-elevated text-fg focus:border-accent/60 rounded-[4px] border px-2 py-1.5 text-xs focus:outline-none"
                  defaultValue="change_event"
                >
                  {POLICY_TRIGGER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {triggerLabel(t)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  Description (optional)
                </span>
                <input
                  type="text"
                  name="description"
                  maxLength={500}
                  className="border-border bg-surface-elevated text-fg focus:border-accent/60 rounded-[4px] border px-2 py-1.5 text-xs focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  Workflow
                </span>
                <select
                  name="workflow_slug"
                  required
                  className="border-border bg-surface-elevated text-fg focus:border-accent/60 rounded-[4px] border px-2 py-1.5 text-xs focus:outline-none"
                >
                  {workflows.map((wf) => (
                    <option key={wf.slug} value={wf.slug}>
                      {wf.name} ({wf.intent})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                    Cooldown (s)
                  </span>
                  <input
                    type="number"
                    name="cooldown_seconds"
                    min={0}
                    max={86400}
                    defaultValue={300}
                    className="border-border bg-surface-elevated text-fg focus:border-accent/60 rounded-[4px] border px-2 py-1.5 text-xs tabular-nums focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                    Max/hr
                  </span>
                  <input
                    type="number"
                    name="max_fires_per_hour"
                    min={1}
                    max={1000}
                    defaultValue={10}
                    className="border-border bg-surface-elevated text-fg focus:border-accent/60 rounded-[4px] border px-2 py-1.5 text-xs tabular-nums focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                    Chain depth
                  </span>
                  <input
                    type="number"
                    name="max_chain_depth"
                    min={0}
                    max={10}
                    defaultValue={3}
                    className="border-border bg-surface-elevated text-fg focus:border-accent/60 rounded-[4px] border px-2 py-1.5 text-xs tabular-nums focus:outline-none"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  Conditions (JSON, optional)
                </span>
                <textarea
                  name="conditions"
                  rows={3}
                  placeholder='{"kinds":["positioning_change","tagline_change"]}'
                  className="border-border bg-surface-elevated text-fg placeholder:text-muted-fg/50 focus:border-accent/60 rounded-[4px] border px-2 py-1.5 font-mono text-[10px] focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
                  Workflow input (JSON, optional)
                </span>
                <textarea
                  name="workflow_input"
                  rows={3}
                  placeholder='{"depth":"fast"}'
                  className="border-border bg-surface-elevated text-fg placeholder:text-muted-fg/50 focus:border-accent/60 rounded-[4px] border px-2 py-1.5 font-mono text-[10px] focus:outline-none"
                />
              </label>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="bg-accent/10 text-accent border-accent/40 hover:bg-accent/20 rounded-[4px] border px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors"
                >
                  Create policy
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Policies list */}
        <section>
          <h2 className="text-fg mb-4 text-base font-semibold">Active policies</h2>
          {policies.length === 0 ? (
            <div className="border-border flex min-h-[100px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                No policies yet. Create one above to auto-trigger workflows on events.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map((p) => {
                const fires = firesByPolicy.get(p.id) ?? [];
                return (
                  <div
                    key={p.id}
                    className={`rounded-[8px] border p-4 ${p.enabled ? 'border-border bg-surface' : 'border-border/50 bg-surface opacity-60'}`}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-fg text-sm font-semibold">{p.name}</p>
                          <span className="bg-surface-elevated text-muted-fg rounded px-1.5 py-0.5 font-mono text-[9px]">
                            {triggerLabel(p.triggerType)}
                          </span>
                          <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 font-mono text-[9px]">
                            → {p.workflowSlug}
                          </span>
                        </div>
                        {p.description && (
                          <p className="text-muted-fg mt-1 text-xs">{p.description}</p>
                        )}
                        <p className="text-muted-fg mt-1 font-mono text-[10px]">
                          Fired {p.fireCount}× · cooldown {p.cooldownSeconds}s · {p.maxFiresPerHour}
                          /hr · depth ≤{p.maxChainDepth}
                          {p.lastFiredAt &&
                            ` · last ${new Date(p.lastFiredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <form action={togglePolicy}>
                          <input type="hidden" name="workspace" value={slug} />
                          <input type="hidden" name="policy_id" value={p.id} />
                          <input type="hidden" name="enabled" value={String(!p.enabled)} />
                          <button
                            type="submit"
                            className={`rounded-[4px] px-2 py-1 font-mono text-[10px] transition-colors ${
                              p.enabled
                                ? 'border-border text-muted-fg hover:text-fg border'
                                : 'border-accent/40 text-accent hover:bg-accent/10 border'
                            }`}
                          >
                            {p.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </form>

                        <form action={deleteEventPolicy}>
                          <input type="hidden" name="workspace" value={slug} />
                          <input type="hidden" name="policy_id" value={p.id} />
                          <button
                            type="submit"
                            title="Delete policy"
                            className="border-border text-muted-fg hover:border-danger/40 hover:text-danger flex items-center justify-center rounded-[4px] border p-1.5 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>

                    {fires.length > 0 && (
                      <div className="border-border/40 mt-3 border-t pt-3">
                        <p className="text-muted-fg mb-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
                          <Zap className="h-3 w-3" />
                          Recent fires
                        </p>
                        <ul className="space-y-1">
                          {fires.map((f) => (
                            <li
                              key={f.id}
                              className="flex items-center gap-3 font-mono text-[10px]"
                            >
                              <span className={`rounded px-1.5 py-0.5 ${resultClass(f.result)}`}>
                                {f.result}
                              </span>
                              {f.brandId && <span className="text-muted-fg">{f.brandId}</span>}
                              {f.error && <span className="text-danger truncate">{f.error}</span>}
                              <span className="text-muted-fg ml-auto">
                                {new Date(f.firedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
