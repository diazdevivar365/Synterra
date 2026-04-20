// @synterra/billing — authoritative billing surface.
//
// Exports the plan matrix, add-on pricing, Stripe client factory, and helpers.
// All Stripe product/price IDs are read from env vars at runtime — never hardcoded.
// See PLAN.md §F.1 for the design rationale.

import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Plan slug union
// ---------------------------------------------------------------------------

export type PlanSlug = 'trial' | 'starter' | 'growth' | 'scale' | 'enterprise';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PlanQuotas {
  monthlyCredits: number;
  seats: number;
  workspaces: number | 'unlimited';
  trialDays?: number;
}

export interface BillingPlan {
  slug: PlanSlug;
  name: string;
  /** Monthly list price in USD cents. 0 for free/enterprise plans. */
  priceCents: number;
  currency: 'USD';
  features: readonly string[];
  quotas: PlanQuotas;
  /** Name of the env var that holds the Stripe product ID for this plan. */
  stripeProductIdEnvVar: string;
  /**
   * Name of the env var that holds the Stripe monthly price ID.
   * null for plans that are never checked out (trial, enterprise).
   */
  stripePriceIdMonthlyEnvVar: string | null;
}

// ---------------------------------------------------------------------------
// PLANS constant
// ---------------------------------------------------------------------------

export const PLANS: readonly BillingPlan[] = [
  {
    slug: 'trial',
    name: 'Trial',
    priceCents: 0,
    currency: 'USD',
    features: [],
    quotas: { monthlyCredits: 500, seats: 3, workspaces: 1, trialDays: 14 },
    stripeProductIdEnvVar: 'STRIPE_PRODUCT_ID_TRIAL',
    stripePriceIdMonthlyEnvVar: null,
  },
  {
    slug: 'starter',
    name: 'Starter',
    priceCents: 4900,
    currency: 'USD',
    features: [],
    quotas: { monthlyCredits: 1000, seats: 3, workspaces: 1 },
    stripeProductIdEnvVar: 'STRIPE_PRODUCT_ID_STARTER',
    stripePriceIdMonthlyEnvVar: 'STRIPE_PRICE_ID_STARTER_MONTHLY',
  },
  {
    slug: 'growth',
    name: 'Growth',
    priceCents: 19900,
    currency: 'USD',
    features: [],
    quotas: { monthlyCredits: 8000, seats: 10, workspaces: 3 },
    stripeProductIdEnvVar: 'STRIPE_PRODUCT_ID_GROWTH',
    stripePriceIdMonthlyEnvVar: 'STRIPE_PRICE_ID_GROWTH_MONTHLY',
  },
  {
    slug: 'scale',
    name: 'Scale',
    priceCents: 49900,
    currency: 'USD',
    features: [],
    quotas: { monthlyCredits: 30000, seats: 25, workspaces: 'unlimited' },
    stripeProductIdEnvVar: 'STRIPE_PRODUCT_ID_SCALE',
    stripePriceIdMonthlyEnvVar: 'STRIPE_PRICE_ID_SCALE_MONTHLY',
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    priceCents: 0,
    currency: 'USD',
    features: [],
    quotas: { monthlyCredits: -1, seats: -1, workspaces: 'unlimited' },
    stripeProductIdEnvVar: 'STRIPE_PRODUCT_ID_ENTERPRISE',
    stripePriceIdMonthlyEnvVar: null,
  },
] as const;

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

export const ADD_ONS = {
  extraSeat: {
    priceCents: 1500,
    envVar: 'STRIPE_PRICE_ID_ADDON_SEAT',
  },
  creditPack5k: {
    priceCents: 5000,
    envVar: 'STRIPE_PRICE_ID_ADDON_CREDITS_5K',
  },
} as const;

// ---------------------------------------------------------------------------
// Stripe client factory
// ---------------------------------------------------------------------------

/**
 * Create a typed Stripe client with a pinned API version.
 *
 * Callers pass the secret key explicitly (read from env at the call site) so
 * this module stays pure and testable without env side-effects.
 *
 * API version is pinned — never use 'latest'.
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getPlanBySlug(slug: string): BillingPlan | undefined {
  return PLANS.find((p) => p.slug === slug);
}
