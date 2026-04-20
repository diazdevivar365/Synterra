import { and, eq } from 'drizzle-orm';
import { BarChart2, ChevronDown, FlaskConical, Settings, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { users, workspaceMembers, workspaces } from '@synterra/db';

import { NavLink } from '@/components/nav-link';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { db } from '@/lib/db';
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

  const userRow = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .then((r) => r[0] ?? null);

  const displayName = userRow?.name ?? userRow?.email ?? ctx.role;
  const initials = userRow?.name
    ? userRow.name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (userRow?.email ?? ctx.role).slice(0, 2).toUpperCase();

  const base = `/${slug}`;
  const nav = [
    { href: `${base}/brands`,   label: 'Brands',   icon: BarChart2 },
    { href: `${base}/research`, label: 'Research',  icon: FlaskConical },
    { href: `${base}/generate`, label: 'Generate',  icon: Sparkles },
    { href: `${base}/settings`, label: 'Settings',  icon: Settings },
  ];

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        {/* Workspace indicator */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <WorkspaceSwitcher current={current} options={rows} />
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-fg" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map(({ href, label, icon }) => (
            <NavLink key={href} href={href} icon={icon}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-[10px] font-bold text-muted-fg">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-fg">{displayName}</p>
            <p className="font-mono text-[10px] uppercase text-muted-fg">{ctx.role}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
