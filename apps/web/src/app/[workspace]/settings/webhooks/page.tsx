import { redirect } from 'next/navigation';

import { listWebhookEndpoints } from '@/actions/webhooks';
import { getWorkspaceContext } from '@/lib/workspace-context';

import { WebhooksClient } from './webhooks-client';

export default async function WebhooksPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');
  if (ctx.role !== 'owner' && ctx.role !== 'admin') redirect('.');

  const endpoints = await listWebhookEndpoints();

  return <WebhooksClient endpoints={endpoints} />;
}
