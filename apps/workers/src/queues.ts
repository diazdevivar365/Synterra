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
  NOTIFICATIONS: 'synterra-notifications',
  WEEKLY_DIGEST: 'synterra-weekly-digest',
  WEBHOOK_DISPATCH: 'synterra-webhook-dispatch',
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

export type WeeklyDigestJobData = Record<string, never>;

export interface NotifyBrandChangeJobData {
  workspaceId: string;
  brandId: string;
  changeId: string;
  eventType: string;
  severity: string;
  title: string;
  description: string | null;
}

export interface WebhookDispatchJobData {
  workspaceId: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
}
