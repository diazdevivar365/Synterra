import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';
import { brandNameFromId } from '@/lib/brands';

export type ActivityItemType = 'run' | 'change' | 'fire';
export type ActivityItemStatus = 'ok' | 'error' | 'info';

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  date: string;
  title: string;
  subtitle: string;
  status: ActivityItemStatus;
  href: string | null;
}

export async function getActivityFeed(workspaceId: string, slug: string): Promise<ActivityItem[]> {
  const [runsData, changesData, firesData] = await Promise.all([
    aquilaFetch<{
      runs: {
        run_id: string;
        brand_id: string | null;
        url: string;
        status: string;
        created_at: string;
      }[];
    }>(workspaceId, '/research/runs?limit=20'),
    aquilaFetch<{
      by_brand: {
        brand_id: string;
        events: { kind: string; after: string; date: string }[];
      }[];
    }>(workspaceId, '/insights/recent-changes?days=14'),
    aquilaFetch<{
      fires: {
        id: number;
        rule_id: number;
        brand_id: string | null;
        error: string | null;
        fired_at: string;
      }[];
    }>(workspaceId, '/alerting/fires?limit=20'),
  ]);

  const items: ActivityItem[] = [];

  for (const run of runsData?.runs ?? []) {
    const name = run.brand_id ? brandNameFromId(run.brand_id) : run.url;
    items.push({
      id: `run-${run.run_id}`,
      type: 'run',
      date: run.created_at,
      title: `Research — ${name}`,
      subtitle: run.status,
      status: run.status === 'done' ? 'ok' : run.status === 'error' ? 'error' : 'info',
      href: run.brand_id ? `/${slug}/brands/${run.brand_id}` : null,
    });
  }

  for (const brand of changesData?.by_brand ?? []) {
    for (const ev of brand.events.slice(0, 3)) {
      items.push({
        id: `change-${brand.brand_id}-${ev.date}`,
        type: 'change',
        date: ev.date,
        title: `${brandNameFromId(brand.brand_id)} — ${ev.kind.replace(/_/g, ' ')}`,
        subtitle: ev.after.slice(0, 120),
        status: 'info',
        href: `/${slug}/brands/${brand.brand_id}/changes`,
      });
    }
  }

  for (const fire of firesData?.fires ?? []) {
    items.push({
      id: `fire-${fire.id}`,
      type: 'fire',
      date: fire.fired_at,
      title: `Alert rule #${fire.rule_id} fired`,
      subtitle: fire.error ?? (fire.brand_id ? brandNameFromId(fire.brand_id) : ''),
      status: fire.error ? 'error' : 'ok',
      href: `/${slug}/alerts`,
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
