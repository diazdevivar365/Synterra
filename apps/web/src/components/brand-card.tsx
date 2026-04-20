import Link from 'next/link';

import { brandInitials, getHealthColor } from '@/lib/brand-utils';

interface Props {
  id: string;
  name: string;
  domain: string;
  healthScore: number;
  lastScannedAt: Date | null;
  workspaceSlug: string;
}

function formatRelativeTime(date: Date): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function BrandCard({
  id, name, domain, healthScore, lastScannedAt, workspaceSlug,
}: Props) {
  const initials = brandInitials(name);
  const colorClass = getHealthColor(healthScore);

  return (
    <Link
      href={`/${workspaceSlug}/brands/${id}`}
      className="group flex flex-col gap-3 rounded-[8px] border border-border bg-surface p-4 transition-colors duration-150 hover:border-accent hover:shadow-[0_0_0_1px_#cb3500]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-sm font-bold text-accent">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{name}</p>
          <p className="truncate font-mono text-xs text-muted-fg">{domain}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-fg">
            DNA Health
          </span>
          <span className={`font-mono text-xs font-medium ${colorClass}`}>
            {healthScore}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      <p className="font-mono text-[10px] text-muted-fg">
        Last scan{' '}
        {lastScannedAt ? formatRelativeTime(lastScannedAt) : 'never'}
      </p>
    </Link>
  );
}
