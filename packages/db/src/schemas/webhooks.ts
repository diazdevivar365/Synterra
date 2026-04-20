import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  // HMAC signing secret — encrypted at rest in the application layer.
  secret: text('secret').notNull(),
  eventTypes: text('event_types').array().notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  failureCount: integer('failure_count').notNull().default(0),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  endpointId: uuid('endpoint_id')
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull(),
  responseCode: integer('response_code'),
  responseBody: text('response_body'),
  attempt: integer('attempt').notNull().default(1),
  succeededAt: timestamp('succeeded_at', { withTimezone: true }),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
