import { Queue, Worker, type Job } from 'bullmq';
import { eq, isNull } from 'drizzle-orm';
import { Resend } from 'resend';

import {
  brandChanges,
  createDb,
  serviceRoleQuery,
  users,
  workspaceMembers,
  workspaceQuotas,
  workspaces,
} from '@synterra/db';
import { renderWeeklyDigest, type DigestChange } from '@synterra/emails';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type WeeklyDigestJobData } from './queues.js';

import type { Redis } from 'ioredis';

const REPEAT_JOB_ID = 'weekly-digest-repeatable';
const DIGEST_CRON = '0 9 * * 1'; // Every Monday 09:00 UTC

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function sendDigestForWorkspace(
  db: ReturnType<typeof createDb>,
  resend: Resend,
  ws: { id: string; name: string; slug: string },
  weekStart: Date,
  weekEnd: Date,
): Promise<void> {
  const [changes, quota, members] = await Promise.all([
    serviceRoleQuery(db, (tx) =>
      tx
        .select({
          brandId: brandChanges.brandId,
          title: brandChanges.title,
          severity: brandChanges.severity,
          occurredAt: brandChanges.occurredAt,
        })
        .from(brandChanges)
        .where(eq(brandChanges.workspaceId, ws.id))
        .then((rows) => rows.filter((r) => r.occurredAt >= weekStart)),
    ),
    serviceRoleQuery(db, (tx) =>
      tx
        .select({ creditsConsumed: workspaceQuotas.creditsConsumed })
        .from(workspaceQuotas)
        .where(eq(workspaceQuotas.workspaceId, ws.id))
        .then((r) => r[0] ?? null),
    ),
    serviceRoleQuery(db, (tx) =>
      tx
        .select({ email: users.email })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(eq(workspaceMembers.workspaceId, ws.id)),
    ),
  ]);

  if (members.length === 0) {
    logger.debug(
      { event: 'digest.no_members', workspaceId: ws.id },
      'no members to notify, skipping',
    );
    return;
  }

  const brandsMonitored = new Set(changes.map((c) => c.brandId)).size;
  const runsCompleted = changes.length;
  const creditsUsed = quota?.creditsConsumed ?? 0;
  const dashboardUrl = `${env.APP_URL}/${ws.slug}`;

  const digestChanges: DigestChange[] = changes
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .map((c) => ({
      brandName: c.brandId,
      title: c.title,
      severity: c.severity,
      occurredAt: formatDate(c.occurredAt),
    }));

  const html = await renderWeeklyDigest({
    workspaceName: ws.name,
    weekStart: formatDate(weekStart),
    weekEnd: formatDate(weekEnd),
    changes: digestChanges,
    brandsMonitored,
    runsCompleted,
    creditsUsed,
    dashboardUrl,
  });

  await Promise.allSettled(
    members.map(async (m) => {
      const { error } = await resend.emails.send({
        from: 'Forgentic <digest@forgentic.io>',
        to: m.email,
        subject: `Weekly Brand Pulse — ${ws.name}`,
        html,
      });
      if (error) {
        logger.warn(
          { event: 'digest.email.failed', workspaceId: ws.id, email: m.email, error },
          'digest email failed',
        );
      }
    }),
  );
}

export function createDigestWorker(connection: Redis): Worker<WeeklyDigestJobData> {
  const db = createDb(env.DATABASE_URL);
  const resend = new Resend(env.RESEND_API_KEY);

  return new Worker<WeeklyDigestJobData>(
    QUEUE_NAMES.WEEKLY_DIGEST,
    async (_job: Job<WeeklyDigestJobData>) => {
      const weekEnd = new Date();
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startedAt = Date.now();

      logger.info(
        { event: 'digest.tick.start', weekStart: weekStart.toISOString() },
        'weekly digest tick start',
      );

      const activeWorkspaces = await serviceRoleQuery(db, (tx) =>
        tx
          .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
          .from(workspaces)
          .where(isNull(workspaces.deletedAt)),
      );

      let sent = 0;
      let errored = 0;

      for (const ws of activeWorkspaces) {
        try {
          await sendDigestForWorkspace(db, resend, ws, weekStart, weekEnd);
          sent += 1;
        } catch (err) {
          errored += 1;
          logger.warn(
            {
              event: 'digest.workspace.error',
              workspaceId: ws.id,
              err: { message: (err as Error).message },
            },
            'digest failed for workspace',
          );
        }
      }

      logger.info(
        {
          event: 'digest.tick.done',
          total: activeWorkspaces.length,
          sent,
          errored,
          durationMs: Date.now() - startedAt,
        },
        'weekly digest tick done',
      );
    },
    { connection, concurrency: 1, autorun: true },
  );
}

export async function registerDigestRepeatable(connection: Redis): Promise<Queue> {
  const queue = new Queue<WeeklyDigestJobData>(QUEUE_NAMES.WEEKLY_DIGEST, { connection });

  await queue.add('digest-tick', {} as WeeklyDigestJobData, {
    repeat: { pattern: DIGEST_CRON },
    jobId: REPEAT_JOB_ID,
    removeOnComplete: 10,
    removeOnFail: 50,
  });

  logger.info(
    { event: 'digest.repeatable.registered', cron: DIGEST_CRON },
    'weekly digest repeatable registered',
  );

  return queue;
}
