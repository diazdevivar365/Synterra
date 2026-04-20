import { formatDistanceToNow } from 'date-fns';

import type { ChangeEventSeverity } from '@/lib/brand-changes';

export interface ChangeEventCardProps {
  id: string;
  eventType: string;
  severity: ChangeEventSeverity;
  title: string;
  description?: string | null;
  occurredAt: Date;
}

const SEVERITY_DOT: Record<ChangeEventSeverity, string> = {
  info:     'bg-muted-fg',
  warning:  'bg-warning',
  critical: 'bg-danger',
};

const SEVERITY_TEXT: Record<ChangeEventSeverity, string> = {
  info:     'text-muted-fg',
  warning:  'text-warning',
  critical: 'text-danger',
};

export function ChangeEventCard({
  id,
  eventType,
  severity,
  title,
  description,
  occurredAt,
}: ChangeEventCardProps) {
  return (
    <div
      data-testid={`change-event-card-${id}`}
      className="flex items-start gap-3 rounded-[8px] border border-border bg-surface px-4 py-3 transition-colors duration-150"
    >
      {/* Severity dot */}
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[severity]}`}
        aria-label={`severity: ${severity}`}
      />

      <div className="min-w-0 flex-1">
        {/* Top row: title + timestamp */}
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-sm font-medium ${SEVERITY_TEXT[severity]}`}>{title}</p>
          <time
            dateTime={occurredAt.toISOString()}
            className="shrink-0 font-mono text-[10px] text-muted-fg"
          >
            {formatDistanceToNow(occurredAt, { addSuffix: true })}
          </time>
        </div>

        {/* Description (optional) */}
        {description && (
          <p className="mt-0.5 text-xs text-muted-fg">{description}</p>
        )}

        {/* Event type badge */}
        <span className="mt-1.5 inline-block font-mono text-[10px] uppercase tracking-wider text-muted-fg">
          {eventType.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
}
