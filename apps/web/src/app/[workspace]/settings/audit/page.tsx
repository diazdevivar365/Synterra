import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { auditLog, workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

const SCALE_PLANS = new Set(['scale', 'enterprise']);

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const [ws] = await db
    .select({ planId: workspaces.planId, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .limit(1);

  if (!ws) redirect('/workspaces');

  if (!SCALE_PLANS.has(ws.planId)) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Audit log</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="mb-1 text-sm font-medium text-gray-700">Scale plan required</p>
          <p className="mb-4 text-sm text-gray-500">
            Audit logs are available on Scale and Enterprise plans.
          </p>
          <a
            href={`/${ws.slug}/billing`}
            className="inline-flex items-center rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Upgrade plan
          </a>
        </div>
      </div>
    );
  }

  const { page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr ?? 1));
  const limit = 50;
  const offset = (page - 1) * limit;

  const entries = await db
    .select({
      id: auditLog.id,
      actorKind: auditLog.actorKind,
      actorUserId: auditLog.actorUserId,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(eq(auditLog.workspaceId, ctx.workspaceId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = entries.length > limit;
  const rows = hasMore ? entries.slice(0, limit) : entries;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Audit log</h1>
        <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          Scale
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                  {new Date(entry.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                    {entry.actorKind}
                  </span>
                  {entry.actorUserId && (
                    <span className="ml-1 font-mono text-xs text-gray-400">
                      {entry.actorUserId.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">
                  {entry.action}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {entry.resourceType && (
                    <span>
                      {entry.resourceType}
                      {entry.resourceId && (
                        <span className="ml-1 font-mono text-gray-400">
                          {entry.resourceId.slice(0, 8)}
                        </span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm italic text-gray-400">
                  No audit events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <a
              href={`?page=${page - 1}`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Previous
            </a>
          ) : (
            <span />
          )}
          {hasMore && (
            <a
              href={`?page=${page + 1}`}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
