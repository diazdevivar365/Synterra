import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    name: text('name').notNull(),
    // Contract FK with Aquila.organizations.slug — enforced in app layer, not DB FK.
    aquilaOrgSlug: varchar('aquila_org_slug', { length: 80 }).notNull().unique(),
    planId: varchar('plan_id', { length: 40 }).notNull().default('trial'),
    planStatus: varchar('plan_status', { length: 40 }).notNull().default('trialing'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    dbRoutingKey: varchar('db_routing_key', { length: 80 }).notNull().default('shared'),
    settings: jsonb('settings')
      .notNull()
      .default(sql`'{}'::jsonb`),
    branding: jsonb('branding')
      .notNull()
      .default(sql`'{}'::jsonb`),
    bootstrapUrl: text('bootstrap_url'),
    bootstrapState: varchar('bootstrap_state', { length: 40 }).notNull().default('pending'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('ix_workspaces_plan')
      .on(t.planId)
      .where(sql`deleted_at IS NULL`),
    index('ix_workspaces_active')
      .on(t.id)
      .where(sql`deleted_at IS NULL AND suspended_at IS NULL`),
  ],
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
