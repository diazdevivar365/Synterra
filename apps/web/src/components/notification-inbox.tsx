'use client';

import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface NotificationItem {
  id: string;
  eventType: string;
  payload: {
    title?: string;
    description?: string | null;
    severity?: string;
    brandId?: string;
    changeId?: string;
  };
  readAt: string | null;
  createdAt: string;
}

interface SseEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  severity: string;
  brandId: string;
  changeId: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function severityDot(severity?: string): string {
  if (severity === 'critical') return 'bg-red-500';
  if (severity === 'high') return 'bg-orange-400';
  if (severity === 'medium') return 'bg-yellow-400';
  return 'bg-blue-400';
}

interface Props {
  /** Current workspace slug — used by the "See all" footer link. */
  workspaceSlug: string;
}

export function NotificationInbox({ workspaceSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Load initial list
  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json() as Promise<{ notifications: NotificationItem[]; unreadCount: number }>)
      .then(({ notifications, unreadCount }) => {
        setItems(notifications);
        setUnread(unreadCount);
      })
      .catch(() => null);
  }, []);

  // SSE for real-time delivery
  useEffect(() => {
    const es = new EventSource('/api/notifications/stream');

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as SseEvent;
        const newItem: NotificationItem = {
          id: event.id,
          eventType: event.type,
          payload: {
            title: event.title,
            description: event.description,
            severity: event.severity,
            brandId: event.brandId,
            changeId: event.changeId,
          },
          readAt: null,
          createdAt: event.createdAt,
        };
        setItems((prev) => [newItem, ...prev].slice(0, 50));
        setUnread((n) => n + 1);
      } catch {
        // malformed event — ignore
      }
    };

    return () => es.close();
  }, []);

  // Close on outside click
  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOut);
    return () => document.removeEventListener('mousedown', onClickOut);
  }, []);

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnread((n) => Math.max(0, n - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => null);
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    await Promise.all(
      unreadIds.map((id) => fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })),
    ).catch(() => null);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-fg hover:text-fg relative flex h-7 w-7 items-center justify-center rounded-md transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="bg-accent absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="border-border bg-surface shadow-surface-shadow absolute right-0 top-9 z-50 w-80 rounded-lg border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-fg text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-muted-fg hover:text-fg font-mono text-[10px] uppercase tracking-wider transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="text-muted-fg px-4 py-8 text-center text-sm">No notifications yet</li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.readAt) void markRead(n.id);
                  }}
                  className={[
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors',
                    n.readAt
                      ? 'hover:bg-surface-elevated'
                      : 'bg-surface-elevated/60 hover:bg-surface-elevated',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      severityDot(n.payload.severity),
                    ].join(' ')}
                    role="img"
                    aria-label={n.payload.severity ?? 'info'}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        'truncate text-sm',
                        n.readAt ? 'text-muted-fg' : 'text-fg font-medium',
                      ].join(' ')}
                    >
                      {n.payload.title ?? n.eventType}
                    </p>
                    {n.payload.description && (
                      <p className="text-muted-fg mt-0.5 line-clamp-2 text-xs">
                        {n.payload.description}
                      </p>
                    )}
                    <p className="text-muted-fg mt-1 font-mono text-[10px]">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.readAt && (
                    <span className="bg-accent mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <a
            href={`/${workspaceSlug}/activity`}
            onClick={() => setOpen(false)}
            className="border-border text-muted-fg hover:text-fg block border-t px-4 py-2.5 text-center font-mono text-[10px] uppercase tracking-wider transition-colors"
          >
            See full activity feed →
          </a>
        </div>
      )}
    </div>
  );
}
