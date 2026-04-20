import 'server-only';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Must match QUEUE_NAMES.STRIPE_EVENTS in apps/workers/src/queues.ts
const STRIPE_EVENTS_QUEUE_NAME = 'synterra-stripe-events';

let _connection: IORedis | undefined;
let _stripeEventsQueue: Queue | undefined;

function getConnection(): IORedis {
  if (!_connection) {
    const url = process.env['REDIS_URL'];
    if (!url) throw new Error('REDIS_URL env var is not set');
    _connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _connection;
}

export function getStripeEventsQueue(): Queue {
  _stripeEventsQueue ??= new Queue(STRIPE_EVENTS_QUEUE_NAME, { connection: getConnection() });
  return _stripeEventsQueue;
}
