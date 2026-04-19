// @synterra/billing — public billing surface.
//
// Type-only stub today. Stripe (checkout + subscriptions) and Lago (usage
// metering) wire in W3; the real plan matrix (Explorer / Pro / Team /
// Business / Enterprise) lives in PLAN.md §F.1 and will be seeded here
// during that milestone.

export interface BillingPlan {
  /** URL-safe plan identifier (e.g. `"pro"`, `"team"`). */
  slug: string;
  /** Monthly list price in USD cents. `0` for free plans. */
  priceCents: number;
  /** ISO-4217 currency code. USD-only today; broaden when we localise pricing. */
  currency: 'USD';
  /** Human-readable feature bullets shown on pricing page + in upsell UI. */
  features: readonly string[];
}

/**
 * Authoritative plan list. Empty until W3 — see PLAN.md §F.1 for the design.
 * Readers must tolerate an empty array and fall back to a "free tier" code path.
 */
export const PLANS: readonly BillingPlan[] = [];
