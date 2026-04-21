import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';

async function getStats() {
  const [row] = await db.execute(
    sql`SELECT
      (SELECT count(*)::int FROM workspaces WHERE deleted_at IS NULL) AS workspaces,
      (SELECT count(*)::int FROM users) AS users`,
  );
  return row as { workspaces: number; users: number };
}

export default async function AdminOverviewPage() {
  const stats = await getStats();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Workspaces" value={stats.workspaces} />
        <StatCard label="Users" value={stats.users} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
