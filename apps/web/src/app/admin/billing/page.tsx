import { eq, isNotNull, or, sql } from 'drizzle-orm';

import { serviceRoleQuery, subscriptions, workspaces } from '@synterra/db';

import { db } from '@/lib/db';

async function getProblemWorkspaces() {
  return serviceRoleQuery(db, (tx) =>
    tx
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        planId: workspaces.planId,
        planStatus: workspaces.planStatus,
        suspendedAt: workspaces.suspendedAt,
        stripeCustomerId: subscriptions.stripeCustomerId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      })
      .from(workspaces)
      .leftJoin(subscriptions, eq(subscriptions.workspaceId, workspaces.id))
      .where(or(sql`${workspaces.planStatus} = 'past_due'`, isNotNull(workspaces.suspendedAt)))
      .orderBy(workspaces.updatedAt),
  );
}

export default async function AdminBillingPage() {
  const rows = await getProblemWorkspaces();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Billing ops</h1>
      {rows.length === 0 ? (
        <p className="text-sm italic text-gray-500">No past-due or suspended workspaces.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Workspace</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Issue</th>
                <th className="px-4 py-3 text-left">Stripe customer</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((ws) => (
                <tr key={ws.id}>
                  <td className="px-4 py-3">
                    <a
                      href={`/admin/workspaces/${ws.id}/ops`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {ws.name}
                    </a>
                    <span className="ml-2 font-mono text-xs text-gray-400">{ws.slug}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{ws.planId}</td>
                  <td className="px-4 py-3">
                    {ws.suspendedAt ? (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                        suspended
                      </span>
                    ) : (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        past_due
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {ws.stripeCustomerId ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/admin/workspaces/${ws.id}/ops`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Manage →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
