import { count, ilike, or, sql } from 'drizzle-orm';

import { serviceRoleQuery, workspaceMembers, workspaces } from '@synterra/db';

import { impersonateWorkspaceAction } from '@/app/admin/_actions';
import { db } from '@/lib/db';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

async function listWorkspaces(q?: string) {
  return serviceRoleQuery(db, (tx) =>
    tx
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        planId: workspaces.planId,
        planStatus: workspaces.planStatus,
        suspendedAt: workspaces.suspendedAt,
        deletedAt: workspaces.deletedAt,
        createdAt: workspaces.createdAt,
        memberCount: count(workspaceMembers.userId),
      })
      .from(workspaces)
      .leftJoin(
        workspaceMembers,
        sql`${workspaceMembers.workspaceId} = ${workspaces.id} AND ${workspaceMembers.isDisabled} = false`,
      )
      .where(q ? or(ilike(workspaces.name, `%${q}%`), ilike(workspaces.slug, `%${q}%`)) : undefined)
      .groupBy(workspaces.id)
      .orderBy(workspaces.createdAt)
      .limit(200),
  );
}

export default async function AdminWorkspacesPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const rows = await listWorkspaces(q);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Workspaces</h1>
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or slug…"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white">
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-right"></th>
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
                <td className="px-4 py-3 font-mono text-xs">{ws.planId}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    planStatus={ws.planStatus}
                    suspendedAt={ws.suspendedAt}
                    deletedAt={ws.deletedAt}
                  />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{ws.memberCount}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(ws.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={impersonateWorkspaceAction}>
                    <input type="hidden" name="workspaceId" value={ws.id} />
                    <button
                      type="submit"
                      className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-700"
                    >
                      Entrar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No workspaces found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({
  planStatus,
  suspendedAt,
  deletedAt,
}: {
  planStatus: string;
  suspendedAt: Date | null;
  deletedAt: Date | null;
}) {
  if (deletedAt)
    return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">deleted</span>;
  if (suspendedAt)
    return (
      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">suspended</span>
    );
  if (planStatus === 'past_due')
    return (
      <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">past_due</span>
    );
  if (planStatus === 'active')
    return <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">active</span>;
  return (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{planStatus}</span>
  );
}
