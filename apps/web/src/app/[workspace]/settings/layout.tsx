import { redirect } from 'next/navigation';

import { NavLink } from '@/components/nav-link';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { ReactNode } from 'react';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const base = `/${slug}/settings`;

  return (
    <div className="flex min-h-full">
      <aside className="border-border w-44 shrink-0 border-r p-4">
        <p className="text-muted-fg mb-2 px-3 text-xs font-medium uppercase tracking-wider">
          Settings
        </p>
        <nav className="space-y-0.5">
          <NavLink href={`${base}/general`} exact>
            General
          </NavLink>
          <NavLink href={`${base}/members`} exact>
            Members
          </NavLink>
          {(ctx.role === 'owner' || ctx.role === 'admin') && (
            <NavLink href={`${base}/billing`} exact>
              Billing
            </NavLink>
          )}
          {(ctx.role === 'owner' || ctx.role === 'admin') && (
            <NavLink href={`${base}/sso`} exact>
              SSO
            </NavLink>
          )}
          <NavLink href={`${base}/notifications`} exact>
            Notifications
          </NavLink>
          {(ctx.role === 'owner' || ctx.role === 'admin') && (
            <NavLink href={`${base}/api-keys`} exact>
              API Keys
            </NavLink>
          )}
          {(ctx.role === 'owner' || ctx.role === 'admin') && (
            <NavLink href={`${base}/slack`} exact>
              Slack
            </NavLink>
          )}
          {(ctx.role === 'owner' || ctx.role === 'admin') && (
            <NavLink href={`${base}/webhooks`} exact>
              Webhooks
            </NavLink>
          )}
          <NavLink href={`${base}/audit`} exact>
            Audit log
          </NavLink>
          <NavLink href={`${base}/data`} exact>
            Data &amp; Privacy
          </NavLink>
        </nav>
      </aside>

      <section className="flex-1 p-8">{children}</section>
    </div>
  );
}
