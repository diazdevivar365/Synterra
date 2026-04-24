import { and, eq } from 'drizzle-orm';
import {
  Activity,
  ArrowDownToLine,
  BarChart2,
  BellRing,
  BookOpen,
  Brain,
  CalendarClock,
  Gauge,
  Bot,
  Library,
  ChevronDown,
  CreditCard,
  FlaskConical,
  LineChart,
  Map,
  MessageCircle,
  Pin,
  Plus,
  Settings,
  Sparkles,
  Sparkle,
  Sword,
  Swords,
  Workflow as WorkflowIcon,
  Zap,
} from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { users, workspaceMembers, workspaces } from '@synterra/db';

import { NavLink } from '@/components/nav-link';
import { NotificationInbox } from '@/components/notification-inbox';
import { OmiOverlay } from '@/components/omi-overlay';
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
      suspendedAt: workspaces.suspendedAt,
      suspensionReason: workspaces.suspensionReason,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, ctx.userId), eq(workspaceMembers.isDisabled, false)));

  const current = rows.find((r) => r.id === ctx.workspaceId) ?? {
    id: ctx.workspaceId,
    name: slug,
    slug,
    role: ctx.role,
    suspendedAt: null,
    suspensionReason: null,
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

  const cookieStore = await cookies();
  const impersonatingEmail = cookieStore.get('synterra_admin_impersonating')?.value ?? null;

  const base = `/${slug}`;
  const nav = [
    { href: `${base}/brands`, label: 'Brands', icon: <BarChart2 className="h-4 w-4 shrink-0" /> },
    {
      href: `${base}/discovery`,
      label: 'Discovery',
      icon: <Plus className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/research`,
      label: 'Research',
      icon: <FlaskConical className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/insights`,
      label: 'Insights',
      icon: <LineChart className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/cerebro`,
      label: 'Cerebro',
      icon: <Brain className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/monitors`,
      label: 'Monitores',
      icon: <Gauge className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/toques`,
      label: 'Toque personal',
      icon: <Sparkle className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/agents`,
      label: 'Agentes',
      icon: <Bot className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/references`,
      label: 'Referencias',
      icon: <Library className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/pulse`,
      label: 'Pulse',
      icon: <Activity className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/heatmap`,
      label: 'Heatmap',
      icon: <Map className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/export`,
      label: 'Export',
      icon: <ArrowDownToLine className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/alerts`,
      label: 'Alerts',
      icon: <BellRing className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/automations`,
      label: 'Automations',
      icon: <WorkflowIcon className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/schedules`,
      label: 'Schedules',
      icon: <CalendarClock className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/activity`,
      label: 'Activity',
      icon: <Zap className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/generate`,
      label: 'Generate',
      icon: <Sparkles className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/battlecards`,
      label: 'Battlecards',
      icon: <Sword className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/clash`,
      label: 'Clash',
      icon: <Swords className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/chat`,
      label: 'Chat',
      icon: <MessageCircle className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/glossary`,
      label: 'Glossary',
      icon: <BookOpen className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/pins`,
      label: 'Pins',
      icon: <Pin className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/billing`,
      label: 'Billing',
      icon: <CreditCard className="h-4 w-4 shrink-0" />,
    },
    {
      href: `${base}/settings`,
      label: 'Settings',
      icon: <Settings className="h-4 w-4 shrink-0" />,
    },
  ];

  return (
    <>
      {impersonatingEmail && (
        <div className="flex items-center justify-between bg-indigo-700 px-4 py-2 text-sm text-white">
          <span>
            ⚠ Admin impersonation active — viewing as {displayName} ({impersonatingEmail})
          </span>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/admin/impersonate/exit"
            className="rounded border border-indigo-400 px-3 py-0.5 text-xs hover:bg-indigo-600"
          >
            Exit
          </a>
        </div>
      )}
      {current.suspendedAt && (
        <div className="bg-orange-600 px-4 py-2 text-center text-sm text-white">
          ⚠ This workspace has been suspended.
          {current.suspensionReason ? ` Reason: ${current.suspensionReason}` : ''} Contact support
          to resolve.
        </div>
      )}
      <div className="flex min-h-dvh">
        <aside className="border-border bg-surface flex w-60 shrink-0 flex-col border-r">
          {/* Workspace indicator */}
          <div className="border-border flex h-14 items-center gap-2 border-b px-4">
            <span className="bg-accent h-2 w-2 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <WorkspaceSwitcher current={current} options={rows} />
            </div>
            <ChevronDown className="text-muted-fg h-3.5 w-3.5 shrink-0" />
            <NotificationInbox workspaceSlug={slug} />
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
          <div className="border-border flex items-center gap-3 border-t px-4 py-3">
            <div className="bg-surface-elevated text-muted-fg flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-fg truncate text-xs font-medium">{displayName}</p>
              <p className="text-muted-fg font-mono text-[10px] uppercase">{ctx.role}</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <OmiOverlay workspace={slug} />
    </>
  );
}
