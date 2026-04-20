import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { createAquilaClient, SUPPORTED_CONTRACT_VERSION } from '@synterra/aquila-client';
import { createDb, inflightBootstrap } from '@synterra/db';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type BootstrapAnonJobData } from './queues.js';

import type { Redis } from 'ioredis';

const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_ATTEMPTS = 30; // 30 × 4 s = 2 minutes

export async function bootstrapAnonHandler(job: Job<BootstrapAnonJobData>): Promise<void> {
  const { inflightId, urlInput } = job.data;
  const db = createDb(env.DATABASE_URL);

  const anonClient = createAquilaClient({
    baseUrl: env.AQUILA_BASE_URL,
    apiKey: env.AQUILA_ANON_API_KEY,
    orgSlug: env.AQUILA_ANON_ORG_SLUG,
    contractVersion: SUPPORTED_CONTRACT_VERSION,
  });

  logger.info(
    { event: 'bootstrap-anon.start', inflightId, urlInput },
    'starting anon research run',
  );

  await db
    .update(inflightBootstrap)
    .set({ status: 'running' })
    .where(eq(inflightBootstrap.id, inflightId));

  let run;
  try {
    run = await anonClient.createResearchRun(env.AQUILA_ANON_ORG_ID, {
      query: urlInput,
      metadata: { inflightId, depth: 'shallow' },
    });
  } catch (err) {
    await db
      .update(inflightBootstrap)
      .set({ status: 'failed', error: (err as Error).message })
      .where(eq(inflightBootstrap.id, inflightId));
    throw err;
  }

  await db
    .update(inflightBootstrap)
    .set({ aquilaRunId: run.id })
    .where(eq(inflightBootstrap.id, inflightId));

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));

    const latest = await anonClient.getResearchRun(env.AQUILA_ANON_ORG_ID, run.id);

    if (latest.status === 'succeeded') {
      await db
        .update(inflightBootstrap)
        .set({
          status: 'preview_ready',
          previewData: latest as unknown as Record<string, unknown>,
        })
        .where(eq(inflightBootstrap.id, inflightId));
      logger.info({ event: 'bootstrap-anon.done', inflightId, runId: run.id }, 'preview ready');
      return;
    }

    if (latest.status === 'failed' || latest.status === 'cancelled') {
      await db
        .update(inflightBootstrap)
        .set({ status: 'failed', error: `Aquila run ended with status: ${latest.status}` })
        .where(eq(inflightBootstrap.id, inflightId));
      throw new Error(`Aquila run ${run.id} failed: ${latest.status}`);
    }
  }

  await db
    .update(inflightBootstrap)
    .set({ status: 'failed', error: 'Timed out waiting for Aquila run' })
    .where(eq(inflightBootstrap.id, inflightId));
  throw new Error('bootstrap-anon timed out after 2 minutes');
}

export function createBootstrapWorker(connection: Redis): Worker<BootstrapAnonJobData> {
  const worker = new Worker<BootstrapAnonJobData>(
    QUEUE_NAMES.BOOTSTRAP_ANON,
    (job: Job<BootstrapAnonJobData>) => bootstrapAnonHandler(job),
    { connection, concurrency: 5, autorun: true },
  );

  worker.on('completed', (job) => {
    logger.info(
      { event: 'bootstrap-worker.completed', jobId: job.id, name: job.name },
      'bootstrap job done',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { event: 'bootstrap-worker.failed', jobId: job?.id, err: { message: err.message } },
      'bootstrap job failed',
    );
  });

  return worker;
}
