import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { serviceRoleQuery, slackConnections } from '@synterra/db';

import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function SlackSettingsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');
  const connection = await serviceRoleQuery(db, (tx) =>
    tx
      .select({
        teamName: slackConnections.teamName,
        defaultChannelName: slackConnections.defaultChannelName,
        isEnabled: slackConnections.isEnabled,
      })
      .from(slackConnections)
      .where(eq(slackConnections.workspaceId, ctx.workspaceId))
      .then((r) => r[0] ?? null),
  );

  const connectUrl = `/api/slack/connect`;

  return (
    <div className="max-w-lg">
      <h1 className="text-fg mb-1 text-lg font-semibold">Slack integration</h1>
      <p className="text-muted-fg mb-8 text-sm">
        Connect Slack to receive brand change alerts in your workspace channels.
      </p>

      {connection ? (
        <div className="border-border rounded-lg border p-6">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-green-500"
              aria-hidden="true"
            />
            <span className="text-fg text-sm font-medium">Connected</span>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-fg w-28 shrink-0">Workspace</dt>
              <dd className="text-fg font-medium">{connection.teamName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-fg w-28 shrink-0">Channel</dt>
              <dd className="text-fg font-medium">#{connection.defaultChannelName}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <a
              href={connectUrl}
              className="text-muted-fg hover:text-fg text-sm underline underline-offset-2"
            >
              Reconnect with a different channel
            </a>
          </div>
        </div>
      ) : (
        <div className="border-border rounded-lg border p-6">
          <p className="text-muted-fg mb-6 text-sm">
            No Slack connection found. Connect to start receiving notifications.
          </p>
          <a
            href={connectUrl}
            className="bg-fg text-bg rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          >
            Connect Slack
          </a>
        </div>
      )}
    </div>
  );
}
