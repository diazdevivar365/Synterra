import { sql } from 'drizzle-orm';
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const notificationSubscriptions = pgTable(
  'notification_subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 20 }).notNull(),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    isEnabled: boolean('is_enabled').notNull().default(true),
  },
  (t) => [unique('uq_notif_sub').on(t.workspaceId, t.userId, t.channel, t.eventType)],
);

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id').notNull(),
  userId: uuid('user_id'),
  eventType: varchar('event_type', { length: 80 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  payload: jsonb('payload').notNull(),
  deliveryMeta: jsonb('delivery_meta'),
  error: text('error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect;
export type NewNotificationSubscription = typeof notificationSubscriptions.$inferInsert;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type NewNotificationDelivery = typeof notificationDeliveries.$inferInsert;
