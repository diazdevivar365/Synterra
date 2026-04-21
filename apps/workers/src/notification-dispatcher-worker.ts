import { createDecipheriv } from 'node:crypto';

import { Worker, type Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { Resend } from 'resend';

import {
  createDb,
  notificationDeliveries,
  notificationSubscriptions,
  serviceRoleQuery,
  users,
  workspaces,
  slackConnections,
} from '@synterra/db';
import { renderChangeAlert } from '@synterra/emails';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type NotifyBrandChangeJobData } from './queues.js';

import type { Redis } from 'ioredis';

async function dispatchInApp(
  db: ReturnType<typeof createDb>,
  redis: Redis,
  sub: { id: string; workspaceId: string; userId: string },
  data: NotifyBrandChangeJobData,
): Promise<void> {
  const [delivery] = await serviceRoleQuery(db, (tx) =>
    tx
      .insert(notificationDeliveries)
      .values({
        workspaceId: sub.workspaceId,
        userId: sub.userId,
        eventType: data.eventType,
        channel: 'in_app',
        status: 'delivered',
        payload: data as unknown as Record<string, unknown>,
        sentAt: new Date(),
      })
      .returning(),
  );

  if (!delivery) return;

  const message = JSON.stringify({
    id: delivery.id,
    type: data.eventType,
    title: data.title,
    description: data.description,
    severity: data.severity,
    brandId: data.brandId,
    changeId: data.changeId,
    createdAt: delivery.createdAt.toISOString(),
  });

  await redis.publish(`notif:user:${sub.userId}`, message);
  logger.info(
    { event: 'notif.in_app.sent', userId: sub.userId, deliveryId: delivery.id },
    'in-app notification dispatched',
  );
}

async function dispatchEmail(
  db: ReturnType<typeof createDb>,
  resend: Resend,
  sub: { workspaceId: string; userId: string },
  data: NotifyBrandChangeJobData,
  workspaceName: string,
  workspaceSlug: string,
): Promise<void> {
  const userRow = await serviceRoleQuery(db, (tx) =>
    tx
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, sub.userId))
      .then((r: { email: string; name: string | null }[]) => r[0] ?? null),
  );

  if (!userRow) {
    logger.warn({ event: 'notif.email.no_user', userId: sub.userId }, 'user not found for email');
    return;
  }

  const changeUrl = `${env.APP_URL}/${workspaceSlug}/changes/${data.changeId}`;
  const html = await renderChangeAlert({
    workspaceName,
    brandName: data.brandId,
    title: data.title,
    description: data.description,
    severity: data.severity as 'info' | 'warning' | 'critical',
    changeUrl,
  });

  const { error } = await resend.emails.send({
    from: 'Forgentic <notifications@forgentic.io>',
    to: userRow.email,
    subject: `Brand Alert: ${data.title}`,
    html,
  });

  const status = error ? 'failed' : 'sent';
  await serviceRoleQuery(db, (tx) =>
    tx.insert(notificationDeliveries).values({
      workspaceId: sub.workspaceId,
      userId: sub.userId,
      eventType: data.eventType,
      channel: 'email',
      status,
      payload: data as unknown as Record<string, unknown>,
      error: error ? ((error as { message?: string }).message ?? 'unknown error') : null,
      sentAt: error ? null : new Date(),
    }),
  );

  if (error) {
    logger.error(
      { event: 'notif.email.failed', error, userId: sub.userId },
      'email dispatch failed',
    );
  } else {
    logger.info({ event: 'notif.email.sent', userId: sub.userId }, 'email notification dispatched');
  }
}

function decryptToken(encrypted: string, hexKey: string): string {
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

async function dispatchSlack(
  db: ReturnType<typeof createDb>,
  sub: { workspaceId: string; userId: string },
  data: NotifyBrandChangeJobData,
): Promise<void> {
  const encryptKey = env.SLACK_TOKEN_ENCRYPT_KEY;
  if (!encryptKey) {
    logger.debug({ event: 'notif.slack.no_key' }, 'SLACK_TOKEN_ENCRYPT_KEY not set, skipping');
    return;
  }

  const conn = await serviceRoleQuery(db, (tx) =>
    tx
      .select({
        encryptedBotToken: slackConnections.encryptedBotToken,
        defaultChannelId: slackConnections.defaultChannelId,
        isEnabled: slackConnections.isEnabled,
      })
      .from(slackConnections)
      .where(eq(slackConnections.workspaceId, sub.workspaceId))
      .then((r) => r[0] ?? null),
  );

  if (!conn?.isEnabled) {
    logger.debug(
      { event: 'notif.slack.no_connection', workspaceId: sub.workspaceId },
      'no active slack connection',
    );
    return;
  }

  const botToken = decryptToken(conn.encryptedBotToken, encryptKey);
  const text = `*${data.title}*${data.description ? `\n${data.description}` : ''}\n_Severity: ${data.severity}_`;

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: conn.defaultChannelId, text }),
  });

  const body = (await res.json()) as { ok: boolean; error?: string };
  const status = body.ok ? 'sent' : 'failed';

  await serviceRoleQuery(db, (tx) =>
    tx.insert(notificationDeliveries).values({
      workspaceId: sub.workspaceId,
      userId: sub.userId,
      eventType: data.eventType,
      channel: 'slack',
      status,
      payload: data as unknown as Record<string, unknown>,
      error: body.ok ? null : (body.error ?? 'unknown'),
      sentAt: body.ok ? new Date() : null,
    }),
  );

  if (!body.ok) {
    logger.error(
      { event: 'notif.slack.failed', error: body.error, workspaceId: sub.workspaceId },
      'slack dispatch failed',
    );
  } else {
    logger.info(
      { event: 'notif.slack.sent', workspaceId: sub.workspaceId },
      'slack notification dispatched',
    );
  }
}

export function createNotificationDispatcherWorker(
  connection: Redis,
): Worker<NotifyBrandChangeJobData> {
  const db = createDb(env.DATABASE_URL);
  const resend = new Resend(env.RESEND_API_KEY);

  return new Worker<NotifyBrandChangeJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<NotifyBrandChangeJobData>) => {
      const data = job.data;
      logger.info(
        { event: 'notif.dispatch.start', workspaceId: data.workspaceId, brandId: data.brandId },
        'dispatching brand change notifications',
      );

      const workspace = await serviceRoleQuery(db, (tx) =>
        tx
          .select({ name: workspaces.name, slug: workspaces.slug })
          .from(workspaces)
          .where(eq(workspaces.id, data.workspaceId))
          .then((r: { name: string; slug: string }[]) => r[0] ?? null),
      );

      if (!workspace) {
        logger.error(
          { event: 'notif.dispatch.no_workspace', workspaceId: data.workspaceId },
          'workspace not found, skipping notifications',
        );
        return;
      }

      const subs = await serviceRoleQuery(db, (tx) =>
        tx
          .select()
          .from(notificationSubscriptions)
          .where(
            and(
              eq(notificationSubscriptions.workspaceId, data.workspaceId),
              eq(notificationSubscriptions.eventType, data.eventType),
              eq(notificationSubscriptions.isEnabled, true),
            ),
          ),
      );

      logger.info({ event: 'notif.dispatch.subs', count: subs.length }, 'found subscriptions');

      await Promise.allSettled(
        subs.map((sub: { id: string; workspaceId: string; userId: string; channel: string }) => {
          if (sub.channel === 'in_app') return dispatchInApp(db, connection, sub, data);
          if (sub.channel === 'email')
            return dispatchEmail(db, resend, sub, data, workspace.name, workspace.slug);
          if (sub.channel === 'slack') return dispatchSlack(db, sub, data);
          return Promise.resolve();
        }),
      );
    },
    { connection },
  );
}
