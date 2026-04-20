import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces';

export const brandChanges = pgTable(
  'brand_changes',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    brandId: text('brand_id').notNull(),
    eventType: text('event_type').notNull(),
    severity: text('severity').notNull().default('info'),
    title: text('title').notNull(),
    description: text('description'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('idx_brand_changes_ws_brand').on(t.workspaceId, t.brandId, t.occurredAt),
  ],
);

export type BrandChange = typeof brandChanges.$inferSelect;
export type NewBrandChange = typeof brandChanges.$inferInsert;
