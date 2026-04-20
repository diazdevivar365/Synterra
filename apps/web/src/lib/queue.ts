import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Must match QUEUE_NAMES.PROVISION in apps/workers/src/queues.ts
const PROVISION_QUEUE_NAME = 'synterra-workspace-provision';

export interface ProvisionWorkspaceJobData {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}

let _connection: IORedis | undefined;
let _provisionQueue: Queue<ProvisionWorkspaceJobData> | undefined;

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

export function getProvisionQueue(): Queue<ProvisionWorkspaceJobData> {
  _provisionQueue ??= new Queue(PROVISION_QUEUE_NAME, { connection: getConnection() });
  return _provisionQueue;
}

// Must match QUEUE_NAMES.BOOTSTRAP_ANON in apps/workers/src/queues.ts
const BOOTSTRAP_ANON_QUEUE_NAME = 'synterra-bootstrap-anon';

export interface BootstrapAnonJobData {
  inflightId: string;
  urlInput: string;
  workspaceId?: string;
}

let _bootstrapQueue: Queue<BootstrapAnonJobData> | undefined;

export function getBootstrapAnonQueue(): Queue<BootstrapAnonJobData> {
  _bootstrapQueue ??= new Queue(BOOTSTRAP_ANON_QUEUE_NAME, { connection: getConnection() });
  return _bootstrapQueue;
}
