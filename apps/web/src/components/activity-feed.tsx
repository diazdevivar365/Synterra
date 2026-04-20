import { formatDistanceToNow } from 'date-fns';

export interface ActivityEvent {
  id: string;
  description: string;
  occurredAt: Date;
  type: 'change' | 'scan' | 'alert' | 'info';
}

const DOT: Record<ActivityEvent['type'], string> = {
  change: 'bg-accent',
  scan:   'bg-info',
  alert:  'bg-danger',
  info:   'bg-muted-fg',
};

export function ActivityFeed({ events, max = 8 }: { events: ActivityEvent[]; max?: number }) {
  const visible = events.slice(0, max);
  if (!visible.length) {
    return <p className="font-mono text-xs text-muted-fg">No recent activity.</p>;
  }
  return (
    <ul className="space-y-3">
      {visible.map((e) => (
        <li key={e.id} className="flex items-start gap-3">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[e.type]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg">{e.description}</p>
            <p className="font-mono text-[10px] text-muted-fg">
              {formatDistanceToNow(e.occurredAt, { addSuffix: true })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
