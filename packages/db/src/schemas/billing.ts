import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';

export const plans = pgTable('plans', {
  id: varchar('id', { length: 40 }).primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  stripeProductId: text('stripe_product_id').notNull(),
  stripePriceIdSeat: text('stripe_price_id_seat'),
  stripePriceIdMeter: jsonb('stripe_price_id_meter')
    .notNull()
    .default(sql`'{}'::jsonb`),
  seatIncluded: integer('seat_included').notNull().default(1),
  quotas: jsonb('quotas')
    .notNull()
    .default(sql`'{}'::jsonb`),
  features: jsonb('features')
    .notNull()
    .default(sql`'[]'::jsonb`),
  isVisible: boolean('is_visible').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workspaceId: uuid('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  planId: varchar('plan_id', { length: 40 })
    .notNull()
    .references(() => plans.id),
  status: varchar('status', { length: 40 }).notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAt: timestamp('cancel_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  seatCount: integer('seat_count').notNull().default(1),
  metadata: jsonb('metadata')
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
