/**
 * Stripe events worker — processes BullMQ jobs enqueued by the webhook handler.
 *
 * All DB writes use serviceRoleQuery to bypass RLS — these are cross-workspace
 * writes driven by Stripe callbacks, not user-initiated requests.
 * See packages/db/src/context.ts for the escape-hatch documentation.
 */
import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { createStripeClient } from '@synterra/billing';
import { createDb, serviceRoleQuery, subscriptions } from '@synterra/db';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type StripeEventJobData } from './queues.js';
import { seedWorkspaceQuota } from './quota.js';

import type { Redis } from 'ioredis';
import type Stripe from 'stripe';

export function createStripeEventsWorker(connection: Redis): Worker<StripeEventJobData> {
  const db = createDb(env.DATABASE_URL);
  const _stripe = createStripeClient(env.STRIPE_SECRET_KEY);
  void _stripe; // held for future use (e.g. fetching invoice line items)

  return new Worker<StripeEventJobData>(
    QUEUE_NAMES.STRIPE_EVENTS,
    async (job: Job<StripeEventJobData>) => {
      logger.info(
        { event: 'stripe.event.processing', type: job.name, eventId: job.data.id },
        'processing Stripe event',
      );

      switch (job.name) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = job.data.data.object as unknown as Stripe.Subscription;
          const workspaceId = sub.metadata['workspace_id'];
          const planSlug = sub.metadata['plan_slug'];

          if (!workspaceId) {
            logger.warn(
              { event: 'stripe.event.skip', type: job.name, subscriptionId: sub.id },
              'subscription missing workspace_id metadata — skipping',
            );
            return;
          }

          const now = new Date();
          const periodStart = new Date(sub.current_period_start * 1000);
          const periodEnd = new Date(sub.current_period_end * 1000);
          const customerId =
            typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string }).id;

          const effectivePlanSlug = planSlug ?? 'starter';

          await serviceRoleQuery(db, async (tx) => {
            await tx
              .insert(subscriptions)
              .values({
                workspaceId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: sub.id,
                planId: effectivePlanSlug,
                status: sub.status,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                seatCount: sub.items.data[0]?.quantity ?? 1,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: subscriptions.workspaceId,
                set: {
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: sub.id,
                  planId: effectivePlanSlug,
                  status: sub.status,
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd,
                  seatCount: sub.items.data[0]?.quantity ?? 1,
                  updatedAt: now,
                },
              });

            await seedWorkspaceQuota(tx, workspaceId, effectivePlanSlug, periodStart, periodEnd);
          });

          logger.info(
            {
              event: 'stripe.subscription.upserted',
              workspaceId,
              planSlug: effectivePlanSlug,
              status: sub.status,
            },
            'subscription upserted and quota seeded',
          );
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = job.data.data.object as unknown as Stripe.Subscription;
          const workspaceId = sub.metadata['workspace_id'];

          if (!workspaceId) {
            logger.warn(
              { event: 'stripe.event.skip', type: job.name, subscriptionId: sub.id },
              'subscription missing workspace_id metadata — skipping',
            );
            return;
          }

          await serviceRoleQuery(db, async (tx) => {
            await tx
              .update(subscriptions)
              .set({ status: 'canceled', canceledAt: new Date() })
              .where(eq(subscriptions.workspaceId, workspaceId));
          });

          logger.info(
            { event: 'stripe.subscription.canceled', workspaceId },
            'subscription marked canceled',
          );
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = job.data.data.object as unknown as Stripe.Invoice;
          const subId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : (invoice.subscription as { id: string } | null)?.id;

          if (!subId) {
            logger.info(
              { event: 'stripe.event.skip', type: job.name },
              'invoice has no subscription — skipping',
            );
            return;
          }

          await serviceRoleQuery(db, async (tx) => {
            await tx
              .update(subscriptions)
              .set({ status: 'past_due' })
              .where(eq(subscriptions.stripeSubscriptionId, subId));
          });

          logger.info(
            { event: 'stripe.subscription.past_due', subscriptionId: subId },
            'subscription marked past_due',
          );
          break;
        }

        default:
          logger.info(
            { event: 'stripe.event.unhandled', type: job.name },
            'unhandled Stripe event type — acknowledged',
          );
          return;
      }
    },
    {
      connection,
      concurrency: 3,
      autorun: true,
    },
  );
}
