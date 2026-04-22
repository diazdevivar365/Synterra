import { Pin } from 'lucide-react';
import Link from 'next/link';

import { brandInitials, getHealthColor } from '@/lib/brand-utils';

interface Props {
  id: string;
  name: string;
  domain: string;
  healthScore: number;
  lastScannedAt: Date | null;
  workspaceSlug: string;
  pinned?: boolean;
}

function formatRelativeTime(date: Date): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function BrandCard({
  id,
  name,
  domain,
  healthScore,
  lastScannedAt,
  workspaceSlug,
  pinned,
}: Props) {
  const initials = brandInitials(name);
  const colorClass = getHealthColor(healthScore);

  return (
    <Link
      href={`/${workspaceSlug}/brands/${id}`}
      className="border-border bg-surface hover:border-accent group relative flex flex-col gap-3 rounded-[8px] border p-4 transition-colors duration-150 hover:shadow-[0_0_0_1px_#cb3500]"
    >
      {pinned && (
        <Pin
          className="text-accent absolute right-3 top-3 h-3.5 w-3.5 fill-current"
          aria-label="Pinned"
        />
      )}
      <div className="flex items-center gap-3">
        <div className="bg-surface-elevated text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-fg truncate text-sm font-semibold">{name}</p>
          <p className="text-muted-fg truncate font-mono text-xs">{domain}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wide">
            DNA Health
          </span>
          <span className={`font-mono text-xs font-medium ${colorClass}`}>{healthScore}%</span>
        </div>
        <div className="bg-surface-elevated h-1 w-full overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all duration-500"
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      <p className="text-muted-fg font-mono text-[10px]">
        Last scan {lastScannedAt ? formatRelativeTime(lastScannedAt) : 'never'}
      </p>
    </Link>
  );
}
