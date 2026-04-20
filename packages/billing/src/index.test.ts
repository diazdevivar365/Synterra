import { describe, expect, it, vi } from 'vitest';

// Mock the Stripe constructor before importing the module under test.
vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    _isMockStripeInstance: true,
  }));
  return { default: MockStripe };
});

import { ADD_ONS, PLANS, createStripeClient, getPlanBySlug } from './index';

describe('@synterra/billing — PLANS', () => {
  it('has exactly 5 entries', () => {
    expect(PLANS).toHaveLength(5);
  });

  it('every plan has required fields', () => {
    for (const plan of PLANS) {
      expect(plan).toHaveProperty('slug');
      expect(plan).toHaveProperty('name');
      expect(typeof plan.priceCents).toBe('number');
      expect(plan.currency).toBe('USD');
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan).toHaveProperty('quotas');
      expect(plan).toHaveProperty('stripeProductIdEnvVar');
      // stripePriceIdMonthlyEnvVar is string | null — just confirm property exists
      expect('stripePriceIdMonthlyEnvVar' in plan).toBe(true);
    }
  });

  it('slugs are unique', () => {
    const slugs = PLANS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(PLANS.length);
  });

  it('trial plan has trialDays quota', () => {
    const trial = PLANS.find((p) => p.slug === 'trial');
    expect(trial?.quotas.trialDays).toBe(14);
    expect(trial?.stripePriceIdMonthlyEnvVar).toBeNull();
  });

  it('enterprise plan has unlimited workspaces and null priceId', () => {
    const enterprise = PLANS.find((p) => p.slug === 'enterprise');
    expect(enterprise?.quotas.workspaces).toBe('unlimited');
    expect(enterprise?.stripePriceIdMonthlyEnvVar).toBeNull();
  });
});

describe('@synterra/billing — getPlanBySlug', () => {
  it('returns the starter plan by slug', () => {
    const plan = getPlanBySlug('starter');
    expect(plan).toBeDefined();
    expect(plan?.slug).toBe('starter');
    expect(plan?.priceCents).toBe(4900);
    expect(plan?.quotas.monthlyCredits).toBe(1000);
    expect(plan?.quotas.seats).toBe(3);
    expect(plan?.stripePriceIdMonthlyEnvVar).toBe('STRIPE_PRICE_ID_STARTER_MONTHLY');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getPlanBySlug('nonexistent')).toBeUndefined();
  });
});

describe('@synterra/billing — ADD_ONS', () => {
  it('has extraSeat and creditPack5k', () => {
    expect(ADD_ONS.extraSeat.priceCents).toBe(1500);
    expect(ADD_ONS.extraSeat.envVar).toBe('STRIPE_PRICE_ID_ADDON_SEAT');
    expect(ADD_ONS.creditPack5k.priceCents).toBe(5000);
    expect(ADD_ONS.creditPack5k.envVar).toBe('STRIPE_PRICE_ID_ADDON_CREDITS_5K');
  });
});

describe('@synterra/billing — createStripeClient', () => {
  it('returns a Stripe instance object', () => {
    const client = createStripeClient('sk_test_fake_key');
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });

  it('passes the secret key to the Stripe constructor', async () => {
    const { default: MockStripe } = await import('stripe');
    vi.mocked(MockStripe).mockClear();
    createStripeClient('sk_test_12345');
    expect(MockStripe).toHaveBeenCalledWith('sk_test_12345', {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  });
});
