export interface LagoEventInput {
  transactionId: string;
  externalCustomerId: string;
  code: string;
  timestamp?: string;
  properties?: Readonly<Record<string, string | number | boolean>>;
}

export interface LagoEventResponse {
  event: {
    lagoId: string;
    transactionId: string;
    externalCustomerId: string;
    code: string;
    timestamp: string;
  };
}

export interface LagoUsageCharge {
  billableMetric: { code: string; name: string };
  units: string;
  amountCents: string;
  amountCurrency: string;
}

export interface LagoCustomerUsageResponse {
  customerUsage: {
    fromDatetime: string;
    toDatetime: string;
    issuingDate: string;
    amountCents: string;
    amountCurrency: string;
    totalAmountCents: string;
    chargesUsage: LagoUsageCharge[];
  };
}

export interface LagoClientConfig {
  apiUrl: string;
  apiKey: string;
}

export interface LagoUpsertCustomerInput {
  externalCustomerId: string;
  name?: string;
  email?: string;
  currency?: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface LagoCustomerResponse {
  customer: {
    lagoId: string;
    externalId: string;
    name: string | null;
    email: string | null;
    currency: string | null;
    createdAt: string;
  };
}

export interface LagoClient {
  ingestEvent(input: LagoEventInput): Promise<LagoEventResponse>;
  getCustomerUsage(externalCustomerId: string): Promise<LagoCustomerUsageResponse>;
  upsertCustomer(input: LagoUpsertCustomerInput): Promise<LagoCustomerResponse>;
}
