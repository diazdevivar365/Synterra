/**
 * Synterra Workers — queue name registry.
 *
 * Single source of truth for every BullMQ queue in the system. As we add
 * queues (provisioner, usage-aggregator, notifications, etc.), append here —
 * never inline string literals for queue names in Worker code. Doing so
 * risks drift between producers (API) and consumers (workers) and breaks
 * grep-ability across the monorepo.
 *
 * BullMQ rejects `:` in queue names (Redis uses it as a key separator
 * internally), so we use kebab-case with a `synterra-` prefix for namespacing.
 */
export const QUEUE_NAMES = {
  DEFAULT: 'synterra-default',
  PROVISION: 'synterra-workspace-provision',
  BOOTSTRAP_ANON: 'synterra-bootstrap-anon',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface ProvisionWorkspaceJobData {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}

export interface BootstrapAnonJobData {
  inflightId: string;
  urlInput: string;
  /** Present only for bootstrap-claim jobs. */
  workspaceId?: string;
}
