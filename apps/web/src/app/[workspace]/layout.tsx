import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { NavLink } from '@/components/nav-link';
import { getWorkspaceContext } from '@/lib/workspace-context';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const base = `/${slug}`;

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border bg-surface flex w-56 shrink-0 flex-col border-r">
        <div className="border-border flex h-14 items-center border-b px-4">
          <span className="text-fg truncate text-sm font-semibold">{slug}</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          <NavLink href={`${base}/dashboard`} exact>
            Dashboard
          </NavLink>
          <NavLink href={`${base}/settings`}>Settings</NavLink>
        </nav>

        <div className="border-border border-t p-3">
          <p className="text-muted-fg truncate text-xs">{ctx.role}</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
