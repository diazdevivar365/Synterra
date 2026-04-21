import { isNull, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auditLog, serviceRoleQuery, workspaces } from '@synterra/db';

import { verifyCloudflareAccess } from '@/lib/cloudflare-access';
import { db } from '@/lib/db';

const KNOWN_FLAGS = [
  { key: 'beta_features', label: 'Beta features' },
  { key: 'priority_support', label: 'Priority support' },
  { key: 'custom_aquila_limits', label: 'Custom Aquila limits' },
  { key: 'early_access_research', label: 'Early access: research v2' },
] as const;

type FlagKey = (typeof KNOWN_FLAGS)[number]['key'];

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  flags: Record<string, boolean>;
}

async function listWorkspacesWithFlags(): Promise<WorkspaceRow[]> {
  const rows = await serviceRoleQuery(db, (tx) =>
    tx
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        settings: workspaces.settings,
      })
      .from(workspaces)
      .where(isNull(workspaces.deletedAt))
      .orderBy(workspaces.name)
      .limit(500),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    flags: (r.settings as { flags?: Record<string, boolean> }).flags ?? {},
  }));
}

export default async function AdminFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const all = await listWorkspacesWithFlags();
  const rows = q
    ? all.filter((ws) => ws.name.toLowerCase().includes(q.toLowerCase()) || ws.slug.includes(q))
    : all;

  async function toggleFlag(workspaceId: string, flag: FlagKey, enabled: boolean) {
    'use server';
    const h = await headers();
    const identity = await verifyCloudflareAccess(h);
    if (!identity) return;
    await serviceRoleQuery(db, async (tx) => {
      await tx.execute(
        sql`UPDATE workspaces SET settings = jsonb_set(coalesce(settings,'{}'), array['flags',${flag}], ${enabled}::text::jsonb, true), updated_at = now() WHERE id = ${workspaceId}`,
      );
      await tx.insert(auditLog).values({
        workspaceId,
        actorKind: 'admin',
        action: 'admin.flag.toggle',
        resourceType: 'workspace',
        resourceId: workspaceId,
        after: { flag, enabled, adminEmail: identity.email },
      });
    });
    redirect(`/admin/flags${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Feature flags</h1>
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Filter workspaces…"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white">
            Filter
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Workspace</th>
              {KNOWN_FLAGS.map((f) => (
                <th key={f.key} className="whitespace-nowrap px-3 py-3 text-center">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((ws) => (
              <tr key={ws.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a
                    href={`/admin/workspaces/${ws.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {ws.name}
                  </a>
                  <span className="ml-2 font-mono text-xs text-gray-400">{ws.slug}</span>
                </td>
                {KNOWN_FLAGS.map((f) => {
                  const enabled = !!ws.flags[f.key];
                  const toggle = toggleFlag.bind(null, ws.id, f.key, !enabled);
                  return (
                    <td key={f.key} className="px-3 py-3 text-center">
                      <form action={toggle}>
                        <button
                          type="submit"
                          title={enabled ? 'Disable' : 'Enable'}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                          />
                        </button>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={KNOWN_FLAGS.length + 1}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No workspaces match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
