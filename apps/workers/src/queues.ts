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
  STRIPE_EVENTS: 'synterra-stripe-events',
  USAGE_AGGREGATOR: 'synterra-usage-aggregator',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface ProvisionWorkspaceJobData {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}

export type UsageAggregatorJobData = Record<string, never>;

export interface StripeEventJobData {
  id: string;
  type: string;
  object: string;
  data: {
    object: Record<string, unknown>;
  };
  livemode: boolean;
  created: number;
  [key: string]: unknown;
}
