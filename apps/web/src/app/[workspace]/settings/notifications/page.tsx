import { redirect } from 'next/navigation';

import { getSubscriptions, upsertSubscription } from '@/actions/notifications';
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENT_TYPES } from '@/lib/notifications';
import { getWorkspaceContext } from '@/lib/workspace-context';

const EVENT_LABELS: Record<string, string> = {
  'brand.change.detected': 'Brand change detected',
  'brand.change.critical': 'Critical brand change',
  'competitor.added': 'Competitor added',
  'research.completed': 'Research run completed',
  'quota.warning': 'Quota warning (80%)',
  'quota.exceeded': 'Quota exceeded',
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-app',
  email: 'Email',
};

export default async function NotificationsSettingsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect('/workspaces');

  const subs = await getSubscriptions();

  function isEnabled(eventType: string, channel: string): boolean {
    return subs.some((s) => s.eventType === eventType && s.channel === channel && s.isEnabled);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-fg mb-1 text-lg font-semibold">Notification preferences</h1>
      <p className="text-muted-fg mb-8 text-sm">
        Choose how you want to be notified for each event type.
      </p>

      <div className="border-border rounded-lg border">
        {/* Header row */}
        <div
          className="border-border grid border-b"
          style={{ gridTemplateColumns: '1fr repeat(2, 5rem)' }}
        >
          <div className="text-muted-fg px-4 py-3 text-xs font-medium uppercase tracking-wider">
            Event
          </div>
          {NOTIFICATION_CHANNELS.map((ch) => (
            <div
              key={ch}
              className="text-muted-fg px-3 py-3 text-center text-xs font-medium uppercase tracking-wider"
            >
              {CHANNEL_LABELS[ch]}
            </div>
          ))}
        </div>

        {/* Event rows */}
        {NOTIFICATION_EVENT_TYPES.map((eventType, i) => (
          <div
            key={eventType}
            className={[
              'grid items-center',
              i < NOTIFICATION_EVENT_TYPES.length - 1 ? 'border-border border-b' : '',
            ].join(' ')}
            style={{ gridTemplateColumns: '1fr repeat(2, 5rem)' }}
          >
            <div className="px-4 py-3">
              <span className="text-fg text-sm">{EVENT_LABELS[eventType] ?? eventType}</span>
            </div>
            {NOTIFICATION_CHANNELS.map((channel) => {
              const enabled = isEnabled(eventType, channel);
              return (
                <div key={channel} className="flex justify-center px-3 py-3">
                  <form
                    action={async () => {
                      'use server';
                      await upsertSubscription(eventType, channel, !enabled);
                    }}
                  >
                    <button
                      type="submit"
                      aria-label={`${enabled ? 'Disable' : 'Enable'} ${EVENT_LABELS[eventType] ?? eventType} ${CHANNEL_LABELS[channel]} notifications`}
                      className={[
                        'h-5 w-9 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                        enabled ? 'bg-accent' : 'bg-surface-elevated',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'block h-4 w-4 rounded-full bg-white shadow transition-transform',
                          enabled ? 'translate-x-4' : 'translate-x-0.5',
                        ].join(' ')}
                      />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
