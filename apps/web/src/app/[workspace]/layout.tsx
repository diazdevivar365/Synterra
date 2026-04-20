import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { workspaceMembers, workspaces } from '@synterra/db';

import { NavLink } from '@/components/nav-link';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { db } from '@/lib/db';
import { getWorkspaceContext } from '@/lib/workspace-context';

import type { ReactNode } from 'react';

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

  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, ctx.userId), eq(workspaceMembers.isDisabled, false)));

  const current = rows.find((r) => r.id === ctx.workspaceId) ?? {
    id: ctx.workspaceId,
    name: slug,
    slug,
    role: ctx.role,
  };

  const base = `/${slug}`;

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border bg-surface flex w-56 shrink-0 flex-col border-r">
        <div className="border-border flex h-14 items-center border-b px-4">
          <WorkspaceSwitcher current={current} options={rows} />
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
