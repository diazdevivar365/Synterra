/**
 * Usage Aggregator — repeatable BullMQ job (every 60s).
 *
 * W3-3 responsibilities:
 *   - Lago reconciliation: for each active subscription fetch current usage
 *     from Lago and log it. Errors per workspace are caught so one flaky
 *     tenant cannot poison the batch.
 *   - Aquila polling: STUB — AQ-3 is not implemented. Logged once at startup.
 */
import { Queue, Worker, type Job } from 'bullmq';
import { eq, ne } from 'drizzle-orm';

import { createLagoClient, LagoClientError } from '@synterra/billing';
import { createDb, serviceRoleQuery, subscriptions, workspaces } from '@synterra/db';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type UsageAggregatorJobData } from './queues.js';

import type { Redis } from 'ioredis';

const REPEAT_EVERY_MS = 60_000;
const REPEAT_JOB_ID = 'usage-aggregator-repeatable';

export function createUsageAggregatorWorker(connection: Redis): Worker<UsageAggregatorJobData> {
  const db = createDb(env.DATABASE_URL);
  const lago = createLagoClient({ apiUrl: env.LAGO_API_URL, apiKey: env.LAGO_API_KEY });

  logger.info(
    { event: 'usage_aggregator.aquila_polling_skipped', reason: 'AQ-3 not implemented' },
    'aquila usage polling is a stub — will activate when AQ-3 lands',
  );

  return new Worker<UsageAggregatorJobData>(
    QUEUE_NAMES.USAGE_AGGREGATOR,
    async (_job: Job<UsageAggregatorJobData>) => {
      const startedAt = Date.now();
      logger.info({ event: 'usage_aggregator.tick.start' }, 'usage aggregator tick start');

      const active = await serviceRoleQuery(db, async (tx) =>
        tx
          .select({ workspaceId: subscriptions.workspaceId, slug: workspaces.slug })
          .from(subscriptions)
          .innerJoin(workspaces, eq(workspaces.id, subscriptions.workspaceId))
          .where(ne(subscriptions.status, 'canceled')),
      );

      let reconciled = 0;
      let errored = 0;
      let selfHealed = 0;

      for (const ws of active) {
        try {
          const usage = await lago.getCustomerUsage(ws.slug);
          reconciled += 1;
          logger.debug(
            {
              event: 'usage_aggregator.reconcile.ok',
              workspaceId: ws.workspaceId,
              lagoAmountCents: usage.customerUsage.amountCents,
            },
            'lago usage reconciled',
          );
        } catch (err) {
          const is404 = err instanceof LagoClientError && err.status === 404;
          if (is404) {
            // Self-heal: the workspace exists in Synterra but not in Lago.
            // Fixes the provisioning gap for workspaces created before the
            // upsert hook existed.
            try {
              await lago.upsertCustomer({
                externalCustomerId: ws.slug,
                currency: 'USD',
                metadata: { synterra_workspace_id: ws.workspaceId },
              });
              selfHealed += 1;
              logger.info(
                {
                  event: 'usage_aggregator.self_healed',
                  workspaceId: ws.workspaceId,
                  slug: ws.slug,
                },
                'Lago customer upserted after 404 — will reconcile next tick',
              );
              // Don't retry getCustomerUsage now: a just-created customer
              // may have no usage data yet. Next tick will pick it up clean.
              continue;
            } catch (upsertErr) {
              logger.warn(
                {
                  event: 'usage_aggregator.self_heal_failed',
                  workspaceId: ws.workspaceId,
                  err: { message: (upsertErr as Error).message },
                },
                'Lago self-heal upsert failed',
              );
            }
          }
          errored += 1;
          logger.warn(
            {
              event: 'usage_aggregator.reconcile.error',
              workspaceId: ws.workspaceId,
              status: err instanceof LagoClientError ? err.status : undefined,
              err: { message: (err as Error).message },
            },
            'lago reconciliation failed for workspace',
          );
        }
      }

      logger.info(
        {
          event: 'usage_aggregator.tick.done',
          active: active.length,
          reconciled,
          errored,
          selfHealed,
          durationMs: Date.now() - startedAt,
        },
        'usage aggregator tick done',
      );
    },
    { connection, concurrency: 1, autorun: true },
  );
}

export async function registerUsageAggregatorRepeatable(connection: Redis): Promise<Queue> {
  const queue = new Queue<UsageAggregatorJobData>(QUEUE_NAMES.USAGE_AGGREGATOR, { connection });

  await queue.add('aggregate-tick', {} as UsageAggregatorJobData, {
    repeat: { every: REPEAT_EVERY_MS },
    jobId: REPEAT_JOB_ID,
    removeOnComplete: 100,
    removeOnFail: 500,
  });

  logger.info(
    { event: 'usage_aggregator.repeatable.registered', everyMs: REPEAT_EVERY_MS },
    'usage aggregator repeatable registered',
  );

  return queue;
}
