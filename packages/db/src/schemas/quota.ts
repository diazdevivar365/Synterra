import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';

export const workspaceQuotas = pgTable('workspace_quotas', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  creditsGranted: integer('credits_granted').notNull(),
  creditsConsumed: integer('credits_consumed').notNull().default(0),
  softLimitReached: boolean('soft_limit_reached').notNull().default(false),
  hardLimitReached: boolean('hard_limit_reached').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type WorkspaceQuota = typeof workspaceQuotas.$inferSelect;
export type NewWorkspaceQuota = typeof workspaceQuotas.$inferInsert;
