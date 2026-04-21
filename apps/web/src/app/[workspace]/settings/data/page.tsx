import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { workspaces } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function DataPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const [ws] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .limit(1);

  if (!ws) notFound();

  const { error } = await searchParams;
  const isOwner = ctx.role === 'owner';

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Data &amp; Privacy</h1>
        <p className="mt-1 text-sm text-gray-500">
          Export your workspace data or request permanent deletion.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Export data
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Download a JSON file containing all workspace data: brands, changes, and members. Large
          workspaces may take a few seconds to generate.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/workspaces/me/export"
          className="inline-flex items-center rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Download export
        </a>
      </section>

      {isOwner && (
        <section className="rounded-lg border border-red-200 bg-white p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-red-600">
            Delete workspace
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            This permanently deletes <strong>{ws.name}</strong> and all its data. All members lose
            access immediately. Your data will be purged from our systems within{' '}
            <strong>30 days</strong>. This action cannot be undone.
          </p>
          {error === 'confirm_mismatch' && (
            <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              Workspace slug did not match. Please try again.
            </p>
          )}
          <form method="POST" action="/api/workspaces/me/delete" className="space-y-3">
            <div>
              <label
                htmlFor="confirmation"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Type <code className="rounded bg-gray-100 px-1 font-mono text-xs">{ws.slug}</code>{' '}
                to confirm
              </label>
              <input
                id="confirmation"
                name="confirmation"
                type="text"
                required
                placeholder={ws.slug}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              Permanently delete workspace
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
