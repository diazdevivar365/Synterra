/**
 * Workspace provisioner — BullMQ worker for the PROVISION queue.
 *
 * Flow per job:
 *   1. POST /auth/issue-provisioner-token → 5-min JWT
 *   2. POST /orgs → create Aquila org mirroring the Synterra workspace
 *   3. POST /orgs/:slug/api-keys → issue a scoped API key (returned once)
 *   4. AES-256-GCM encrypt the raw key (iv + authTag + ciphertext)
 *   5. INSERT into aquila_credentials (idempotent — skips if row exists)
 */
import { createCipheriv, randomBytes } from 'node:crypto';

import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { createAquilaClient, SUPPORTED_CONTRACT_VERSION } from '@synterra/aquila-client';
import { aquilaCredentials, createDb } from '@synterra/db';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type ProvisionWorkspaceJobData } from './queues.js';

import type { Redis } from 'ioredis';

/** Encrypt rawKey with AES-256-GCM. Output: iv (12 B) + authTag (16 B) + ciphertext. */
export function encryptSecret(rawKey: string, hexKey: string): Buffer {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(rawKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function createProvisionerWorker(connection: Redis): Worker<ProvisionWorkspaceJobData> {
  const aquilaClient = createAquilaClient({
    baseUrl: env.AQUILA_BASE_URL,
    apiKey: '',
    orgSlug: '',
    contractVersion: SUPPORTED_CONTRACT_VERSION,
    provisionerSecret: env.AQUILA_PROVISIONER_SECRET,
  });

  const db = createDb(env.DATABASE_URL);

  return new Worker<ProvisionWorkspaceJobData>(
    QUEUE_NAMES.PROVISION,
    async (job: Job<ProvisionWorkspaceJobData>) => {
      const { workspaceId, workspaceSlug, workspaceName } = job.data;

      logger.info(
        { event: 'provisioner.start', workspaceId, workspaceSlug, attempt: job.attemptsMade },
        'provisioning Aquila org',
      );

      // Idempotency guard: if credentials already exist, skip.
      const existing = await db
        .select({ workspaceId: aquilaCredentials.workspaceId })
        .from(aquilaCredentials)
        .where(eq(aquilaCredentials.workspaceId, workspaceId))
        .limit(1);

      if (existing.length > 0) {
        logger.info(
          { event: 'provisioner.skip', workspaceId },
          'credentials already exist — skipping',
        );
        return;
      }

      const org = await aquilaClient.createOrg({
        slug: workspaceSlug,
        externalId: workspaceId,
        displayName: workspaceName,
      });

      const apiKey = await aquilaClient.issueApiKey(org.slug);

      const encryptedSecret = encryptSecret(apiKey.rawKey, env.AQUILA_ENCRYPT_KEY);
      const prefix = apiKey.rawKey.slice(0, 12);

      await db.insert(aquilaCredentials).values({
        workspaceId,
        apiKeyId: apiKey.id,
        apiKeyPrefix: prefix,
        apiKeySecretEnc: encryptedSecret,
      });

      logger.info(
        { event: 'provisioner.done', workspaceId, orgSlug: org.slug, keyId: apiKey.id },
        'Aquila org provisioned',
      );
    },
    {
      connection,
      concurrency: 2,
      autorun: true,
    },
  );
}
