import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { ssoConnections } from '@synterra/db';

import { SsoSettingsForm } from '@/components/sso-settings-form';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function SsoSettingsPage({ params }: Props) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    redirect(`/${slug}/settings/general`);
  }

  const rows = await db
    .select({
      domain: ssoConnections.domain,
      enabled: ssoConnections.enabled,
      orgId: ssoConnections.workosOrganizationId,
      connectionId: ssoConnections.workosConnectionId,
      directoryId: ssoConnections.workosDirectoryId,
    })
    .from(ssoConnections)
    .where(eq(ssoConnections.workspaceId, ctx.workspaceId))
    .limit(1);

  const conn = rows[0] ?? null;
  const ssoAvailable = !!process.env['WORKOS_API_KEY'];

  return (
    <SsoSettingsForm
      workspaceId={ctx.workspaceId}
      workspaceName={slug}
      callerRole={ctx.role}
      connection={conn}
      ssoAvailable={ssoAvailable}
    />
  );
}
