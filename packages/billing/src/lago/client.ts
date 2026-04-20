import type {
  LagoClient,
  LagoClientConfig,
  LagoCustomerUsageResponse,
  LagoEventInput,
  LagoEventResponse,
} from './types';

export class LagoClientError extends Error {
  readonly status: number;
  readonly body: string;
  readonly url: string;
  constructor(message: string, opts: { status: number; body: string; url: string }) {
    super(message);
    this.name = 'LagoClientError';
    this.status = opts.status;
    this.body = opts.body;
    this.url = opts.url;
  }
}

async function lagoFetch<T>(
  url: string,
  apiKey: string,
  { body, ...restInit }: Omit<RequestInit, 'headers' | 'body'> & { body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    ...restInit,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LagoClientError(
      `lago: ${(restInit.method as string | undefined) ?? 'GET'} ${url} -> HTTP ${res.status}`,
      { status: res.status, body: body.slice(0, 512), url },
    );
  }
  return (await res.json()) as T;
}

export function createLagoClient(config: LagoClientConfig): LagoClient {
  if (!config.apiUrl) throw new Error('lago-client: apiUrl is required');
  if (!config.apiKey) throw new Error('lago-client: apiKey is required');
  const base = config.apiUrl.replace(/\/$/, '');
  const { apiKey } = config;

  return {
    async ingestEvent(input: LagoEventInput): Promise<LagoEventResponse> {
      return lagoFetch<LagoEventResponse>(`${base}/api/v1/events`, apiKey, {
        method: 'POST',
        body: {
          event: {
            transaction_id: input.transactionId,
            external_customer_id: input.externalCustomerId,
            code: input.code,
            timestamp: input.timestamp,
            properties: input.properties,
          },
        },
      });
    },

    async getCustomerUsage(externalCustomerId: string): Promise<LagoCustomerUsageResponse> {
      const encoded = encodeURIComponent(externalCustomerId);
      return lagoFetch<LagoCustomerUsageResponse>(
        `${base}/api/v1/customers/${encoded}/current_usage`,
        apiKey,
        { method: 'GET' },
      );
    },
  };
}

export type { LagoClient, LagoClientConfig } from './types';
