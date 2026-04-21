import { createDecipheriv, createHmac } from 'node:crypto';

import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';

import { createDb, serviceRoleQuery, webhookDeliveries, webhookEndpoints } from '@synterra/db';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type WebhookDispatchJobData } from './queues.js';

import type { Redis } from 'ioredis';

let _db: ReturnType<typeof createDb> | undefined;
function getDb() {
  _db ??= createDb(env.DATABASE_URL);
  return _db;
}

function decryptSecret(encrypted: string, hexKey: string): string {
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function createWebhookDispatcherWorker(connection: Redis): Worker<WebhookDispatchJobData> {
  return new Worker<WebhookDispatchJobData>(
    QUEUE_NAMES.WEBHOOK_DISPATCH,
    async (job) => {
      const { workspaceId, endpointId, eventType, payload } = job.data;

      const encryptKey = env.WEBHOOK_SECRET_ENCRYPT_KEY;
      if (!encryptKey) {
        logger.warn(
          { event: 'webhook.dispatch.skip', endpointId },
          'WEBHOOK_SECRET_ENCRYPT_KEY not set — skipping delivery',
        );
        return;
      }

      const endpoint = await serviceRoleQuery(getDb(), (tx) =>
        tx
          .select()
          .from(webhookEndpoints)
          .where(eq(webhookEndpoints.id, endpointId))
          .then((r) => r[0] ?? null),
      );

      if (!endpoint?.isEnabled) return;

      const body = JSON.stringify({ event: eventType, workspaceId, data: payload });
      let secret: string;
      try {
        secret = decryptSecret(endpoint.secret, encryptKey);
      } catch {
        logger.error(
          { event: 'webhook.dispatch.decrypt_error', endpointId },
          'failed to decrypt webhook secret',
        );
        return;
      }

      const signature = signPayload(secret, body);
      const now = new Date();
      let responseCode: number | null = null;
      let responseBody: string | null = null;
      let succeeded = false;

      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forgentic-Signature': `sha256=${signature}`,
            'X-Forgentic-Event': eventType,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        responseCode = res.status;
        responseBody = await res.text().catch(() => null);
        succeeded = res.ok;
      } catch (err) {
        logger.warn(
          { event: 'webhook.dispatch.fetch_error', endpointId, err: (err as Error).message },
          'webhook delivery failed',
        );
      }

      await serviceRoleQuery(getDb(), async (tx) => {
        await tx.insert(webhookDeliveries).values({
          endpointId,
          workspaceId,
          eventType,
          payload: body,
          responseCode,
          responseBody,
          attempt: job.attemptsMade + 1,
          succeededAt: succeeded ? now : null,
        });

        if (succeeded) {
          await tx
            .update(webhookEndpoints)
            .set({ lastSuccessAt: now, failureCount: 0 })
            .where(eq(webhookEndpoints.id, endpointId));
        } else {
          await tx
            .update(webhookEndpoints)
            .set({ lastFailureAt: now, failureCount: endpoint.failureCount + 1 })
            .where(eq(webhookEndpoints.id, endpointId));
        }
      });
    },
    { connection, concurrency: env.WORKER_CONCURRENCY },
  );
}
