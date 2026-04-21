import { redirect } from 'next/navigation';

import { listApiKeys } from '@/actions/api-keys';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { ApiKeysClient } from './api-keys-client';

export default async function ApiKeysPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    redirect(`/${ctx.slug}/settings/general`);
  }

  const keys = await listApiKeys();

  return <ApiKeysClient keys={keys} />;
}
