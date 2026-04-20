import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users';
import { workspaces } from './workspaces';

// Partitioned append-only usage ledger. PARTITION BY RANGE(created_at) is in
// migration 0007 — Drizzle ORM uses this definition for type inference only.
export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    userId: uuid('user_id').references(() => users.id),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    resourceId: text('resource_id'),
    quantity: integer('quantity').notNull().default(1),
    costCredits: integer('cost_credits').notNull(),
    // Our cost in microdollars (LLM tokens, scrape, etc.) — for margin tracking.
    costUsdMicros: bigint('cost_usd_micros', { mode: 'bigint' }),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    idempotencyKey: text('idempotency_key').unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('ix_usage_ws_time').on(t.workspaceId, t.createdAt),
    index('ix_usage_type').on(t.workspaceId, t.eventType, t.createdAt),
  ],
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
