import { and, eq } from 'drizzle-orm';
import { Clock, Trash2 } from 'lucide-react';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { createSchedule, deleteSchedule, toggleSchedule } from '@/actions/schedules';
import { brandNameFromId, getBrandsForWorkspace } from '@/lib/brands';
import { db } from '@/lib/db';
import { getScheduleChanges, getSchedules, type BrandChangeEvent } from '@/lib/schedules';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

const CADENCE_OPTIONS = [
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: 'Daily', value: 24 },
  { label: 'Weekly', value: 168 },
  { label: 'Monthly', value: 720 },
];

function ChangeTimeline({ events }: { events: BrandChangeEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="border-border/40 mt-3 border-t pt-3">
      <p className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
        Recent changes
      </p>
      <ul className="space-y-1">
        {events.map((ev) => (
          <li key={ev.id} className="flex items-center gap-3 font-mono text-[10px]">
            <span className="bg-surface-elevated text-muted-fg w-28 shrink-0 rounded px-1.5 py-0.5 uppercase tracking-wider">
              {ev.kind.replace(/_/g, ' ')}
            </span>
            <span className="text-fg min-w-0 flex-1 truncate">
              {ev.afterValue ?? ev.beforeValue ?? '—'}
            </span>
            <span className="text-muted-fg shrink-0">
              {new Date(ev.detectedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SchedulesPage({ params }: Props) {
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

  const [schedules, brandsResult] = await Promise.all([
    getSchedules(ws.id),
    getBrandsForWorkspace(ws.id),
  ]);

  const { brands } = brandsResult;
  const scheduledBrandIds = new Set(schedules.map((s) => s.brandId));
  const unscheduledBrands = brands.filter((b) => !scheduledBrandIds.has(b.id));

  // Fetch last 5 changes for each scheduled brand (bounded parallelism).
  const changesByBrand = new Map<string, BrandChangeEvent[]>();
  await Promise.all(
    schedules.slice(0, 20).map(async (s) => {
      const evs = await getScheduleChanges(ws.id, s.brandId, 5);
      changesByBrand.set(s.brandId, evs);
    }),
  );

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-8">
        <h1 className="text-fg text-2xl font-bold">Research Schedules</h1>
        <p className="text-muted-fg font-mono text-xs">
          {schedules.length} scheduled · {unscheduledBrands.length} unscheduled
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Schedule list */}
        <section>
          <h2 className="text-fg mb-4 text-base font-semibold">Active Schedules</h2>
          {schedules.length === 0 ? (
            <div className="border-border flex min-h-[120px] items-center justify-center rounded-[8px] border">
              <p className="text-muted-fg font-mono text-xs">
                No schedules yet — add one from the panel →
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((sched) => (
                <div
                  key={sched.id}
                  className={`rounded-[8px] border p-4 ${sched.enabled ? 'border-border bg-surface' : 'border-border/50 bg-surface opacity-60'}`}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-fg text-sm font-semibold">
                          {brandNameFromId(sched.brandId)}
                        </p>
                        <span className="bg-surface-elevated text-muted-fg rounded px-1.5 py-0.5 font-mono text-[9px]">
                          every {sched.cadenceHours}h
                        </span>
                        {sched.geo && (
                          <span className="bg-accent/10 text-accent rounded px-1.5 py-0.5 font-mono text-[9px]">
                            {sched.geo}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-fg mt-0.5 truncate font-mono text-[10px]">
                        {sched.url}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {sched.nextRunAt && (
                          <span className="text-muted-fg flex items-center gap-1 font-mono text-[10px]">
                            <Clock className="h-3 w-3" />
                            Next:{' '}
                            {new Date(sched.nextRunAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        <span className="text-muted-fg font-mono text-[10px]">
                          {sched.runsCount} run{sched.runsCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <form action={toggleSchedule}>
                        <input type="hidden" name="workspace" value={slug} />
                        <input type="hidden" name="schedule_id" value={sched.id} />
                        <input type="hidden" name="enabled" value={String(!sched.enabled)} />
                        <button
                          type="submit"
                          className={`rounded-[4px] px-2 py-1 font-mono text-[10px] transition-colors ${
                            sched.enabled
                              ? 'border-border text-muted-fg hover:text-fg border'
                              : 'border-accent/40 text-accent hover:bg-accent/10 border'
                          }`}
                        >
                          {sched.enabled ? 'Pause' : 'Resume'}
                        </button>
                      </form>

                      <form action={deleteSchedule}>
                        <input type="hidden" name="workspace" value={slug} />
                        <input type="hidden" name="schedule_id" value={sched.id} />
                        <button
                          type="submit"
                          className="border-border text-muted-fg hover:border-danger/40 hover:text-danger flex items-center justify-center rounded-[4px] border p-1.5 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>

                  <ChangeTimeline events={changesByBrand.get(sched.brandId) ?? []} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add schedule form */}
        <section>
          <h2 className="text-fg mb-4 text-base font-semibold">Add Schedule</h2>
          <div className="border-border bg-surface rounded-[8px] border p-4">
            <form action={createSchedule} className="space-y-3">
              <input type="hidden" name="workspace" value={slug} />
              <input type="hidden" name="depth" value="rendered" />

              <div>
                <label className="text-muted-fg mb-1 block font-mono text-[10px] uppercase tracking-wider">
                  Brand
                </label>
                <select
                  name="brand_id"
                  required
                  className="border-border bg-surface-elevated text-fg focus:border-accent/60 w-full rounded-[4px] border px-2 py-1.5 font-mono text-xs focus:outline-none"
                >
                  <option value="">Select brand…</option>
                  {unscheduledBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                  {unscheduledBrands.length === 0 && <option disabled>All brands scheduled</option>}
                </select>
              </div>

              <div>
                <label className="text-muted-fg mb-1 block font-mono text-[10px] uppercase tracking-wider">
                  URL
                </label>
                <input
                  type="url"
                  name="url"
                  required
                  placeholder="https://brand.com"
                  className="border-border bg-surface-elevated text-fg placeholder:text-muted-fg/50 focus:border-accent/60 w-full rounded-[4px] border px-2 py-1.5 font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-fg mb-1 block font-mono text-[10px] uppercase tracking-wider">
                    Cadence
                  </label>
                  <select
                    name="cadence_hours"
                    defaultValue={168}
                    className="border-border bg-surface-elevated text-fg focus:border-accent/60 w-full rounded-[4px] border px-2 py-1.5 font-mono text-xs focus:outline-none"
                  >
                    {CADENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-muted-fg mb-1 block font-mono text-[10px] uppercase tracking-wider">
                    Geo
                  </label>
                  <select
                    name="geo"
                    defaultValue="ar"
                    className="border-border bg-surface-elevated text-fg focus:border-accent/60 w-full rounded-[4px] border px-2 py-1.5 font-mono text-xs focus:outline-none"
                  >
                    <option value="">None</option>
                    <option value="ar">Argentina</option>
                    <option value="us">USA</option>
                    <option value="br">Brazil</option>
                    <option value="mx">Mexico</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 w-full rounded-[6px] border py-2 font-mono text-xs transition-colors"
              >
                Add Schedule
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
