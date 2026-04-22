import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces';

export const brandPins = pgTable(
  'brand_pins',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    brandId: text('brand_id').notNull(),
    pinnedAt: timestamp('pinned_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    unique('uq_brand_pins').on(t.workspaceId, t.userId, t.brandId),
    index('ix_brand_pins_ws_user').on(t.workspaceId, t.userId),
  ],
);

export type BrandPin = typeof brandPins.$inferSelect;
