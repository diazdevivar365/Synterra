import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { serviceRoleQuery, users, workspaceMembers, workspaces } from '@synterra/db';

import { db } from '@/lib/db';

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function AdminWorkspaceDetailPage({ params }: Props) {
  const { workspaceId } = await params;

  const [ws] = await serviceRoleQuery(db, (tx) =>
    tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
  );
  if (!ws) notFound();

  const members = await serviceRoleQuery(db, (tx) =>
    tx
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        isDisabled: workspaceMembers.isDisabled,
        name: users.name,
        email: users.email,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(workspaceMembers.role),
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/workspaces" className="mb-2 block text-sm text-blue-600 hover:underline">
          ← Workspaces
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{ws.name}</h1>
        <p className="font-mono text-sm text-gray-500">{ws.slug}</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <InfoCard label="Plan" value={ws.planId} />
        <InfoCard label="Status" value={ws.planStatus} />
        <InfoCard
          label="State"
          value={ws.deletedAt ? 'deleted' : ws.suspendedAt ? 'suspended' : 'active'}
        />
      </div>

      {ws.suspendedAt && ws.suspensionReason && (
        <div className="mb-6 rounded border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          Suspended: {ws.suspensionReason}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Members ({members.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => (
              <tr key={m.userId} className={m.isDisabled ? 'opacity-50' : ''}>
                <td className="px-4 py-3">
                  <p className="font-medium">{m.name ?? '—'}</p>
                  <p className="font-mono text-xs text-gray-500">{m.email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{m.role}</td>
                <td className="px-4 py-3">
                  {!m.isDisabled && (
                    <form action="/api/admin/impersonate" method="post">
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <input type="hidden" name="redirectTo" value={`/${ws.slug}`} />
                      <button
                        type="submit"
                        className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                      >
                        Impersonate
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}
