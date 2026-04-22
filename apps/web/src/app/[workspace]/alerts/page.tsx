import { and, eq } from 'drizzle-orm';
import { Bell, Play, Trash2 } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import {
  createAlertRule,
  deleteAlertRule,
  testAlertRule,
  toggleAlertRule,
} from '@/actions/alerting';
import { getAlertingFires, getAlertingRules, getAlertingTemplates } from '@/lib/alerting';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

function triggerLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AlertsPage({ params }: Props) {
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

  const [rules, templates, fires] = await Promise.all([
    getAlertingRules(ws.id),
    getAlertingTemplates(ws.id),
    getAlertingFires(ws.id),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Alerting Rules</h1>
        <p className="text-muted-fg font-mono text-xs">
          {rules.length} rule{rules.length !== 1 ? 's' : ''} · {fires.length} recent fires
        </p>
      </div>

      <div className="space-y-10">
        {/* Active rules */}
        <section>
          <h2 className="text-fg mb-4 text-base font-semibold">Active Rules</h2>
          {rules.length === 0 ? (
            <div className="border-border flex min-h-[100px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                No rules yet — add one from the templates below.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-[8px] border p-4 ${rule.enabled ? 'border-border bg-surface' : 'border-border/50 bg-surface opacity-60'}`}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-fg text-sm font-semibold">{rule.name}</p>
                        <span className="bg-surface-elevated text-muted-fg rounded px-1.5 py-0.5 font-mono text-[9px]">
                          {triggerLabel(rule.triggerType)}
                        </span>
                        <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 font-mono text-[9px]">
                          {rule.actionType}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="text-muted-fg mt-1 text-xs">{rule.description}</p>
                      )}
                      <p className="text-muted-fg mt-1 font-mono text-[10px]">
                        Fired {rule.fireCount}×
                        {rule.lastFiredAt &&
                          ` · last ${new Date(rule.lastFiredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <form action={toggleAlertRule}>
                        <input type="hidden" name="workspace" value={slug} />
                        <input type="hidden" name="rule_id" value={rule.id} />
                        <input type="hidden" name="enabled" value={String(!rule.enabled)} />
                        <button
                          type="submit"
                          className={`rounded-[4px] px-2 py-1 font-mono text-[10px] transition-colors ${
                            rule.enabled
                              ? 'border-border text-muted-fg hover:text-fg border'
                              : 'border-accent/40 text-accent hover:bg-accent/10 border'
                          }`}
                        >
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </form>

                      <form action={testAlertRule}>
                        <input type="hidden" name="workspace" value={slug} />
                        <input type="hidden" name="rule_id" value={rule.id} />
                        <button
                          type="submit"
                          title="Fire with dummy event"
                          className="border-border text-muted-fg hover:text-fg flex items-center gap-1 rounded-[4px] border px-2 py-1 font-mono text-[10px] transition-colors"
                        >
                          <Play className="h-3 w-3" />
                          Test
                        </button>
                      </form>

                      <form action={deleteAlertRule}>
                        <input type="hidden" name="workspace" value={slug} />
                        <input type="hidden" name="rule_id" value={rule.id} />
                        <button
                          type="submit"
                          title="Delete rule"
                          className="border-border text-muted-fg hover:border-danger/40 hover:text-danger flex items-center justify-center rounded-[4px] border p-1.5 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Templates */}
        <section>
          <h2 className="text-fg mb-4 text-base font-semibold">Templates</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((tpl, i) => (
              <div key={i} className="border-border bg-surface rounded-[8px] border p-4">
                <div className="mb-2 flex items-start gap-2">
                  <Bell className="text-muted-fg mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-fg text-sm font-semibold">{tpl.name}</p>
                    <p className="text-muted-fg mt-0.5 text-xs">{tpl.description}</p>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <span className="bg-surface-elevated text-muted-fg rounded px-1.5 py-0.5 font-mono text-[9px]">
                    {triggerLabel(tpl.triggerType)}
                  </span>
                  <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 font-mono text-[9px]">
                    {tpl.actionType}
                  </span>
                </div>
                <form action={createAlertRule} className="flex gap-2">
                  <input type="hidden" name="workspace" value={slug} />
                  <input type="hidden" name="name" value={tpl.name} />
                  <input type="hidden" name="description" value={tpl.description} />
                  <input type="hidden" name="trigger_type" value={tpl.triggerType} />
                  <input type="hidden" name="conditions" value={JSON.stringify(tpl.conditions)} />
                  <input type="hidden" name="action_type" value={tpl.actionType} />
                  <input
                    type="hidden"
                    name="action_config"
                    value={JSON.stringify(tpl.actionConfig)}
                  />
                  <input
                    type="text"
                    name="webhook_url_display"
                    placeholder="https://hooks.slack.com/services/..."
                    className="border-border bg-surface-elevated text-fg placeholder:text-muted-fg/50 focus:border-accent/60 min-w-0 flex-1 rounded-[4px] border px-2 py-1.5 font-mono text-[10px] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 shrink-0 rounded-[4px] border px-3 py-1.5 font-mono text-[10px] transition-colors"
                  >
                    Add
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        {/* Fire history */}
        {fires.length > 0 && (
          <section>
            <h2 className="text-fg mb-4 text-base font-semibold">Recent Fires</h2>
            <div className="space-y-2">
              {fires.map((fire) => (
                <div
                  key={fire.id}
                  className="border-border bg-surface flex items-start gap-3 rounded-[8px] border px-4 py-3"
                >
                  <div
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${fire.error ? 'bg-danger' : 'bg-accent'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-fg font-mono text-xs">Rule #{fire.ruleId}</span>
                      {fire.brandId && (
                        <span className="text-muted-fg font-mono text-[10px]">
                          · {fire.brandId}
                        </span>
                      )}
                      <span className="text-muted-fg ml-auto font-mono text-[10px]">
                        {new Date(fire.firedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    {fire.error && (
                      <p className="text-danger mt-1 font-mono text-[10px]">{fire.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
