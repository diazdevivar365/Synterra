export const NOTIFICATION_EVENT_TYPES = [
  'brand.change.detected',
  'brand.change.critical',
  'competitor.added',
  'research.completed',
  'quota.warning',
  'quota.exceeded',
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface SubscriptionRow {
  id: string;
  eventType: string;
  channel: string;
  isEnabled: boolean;
}
