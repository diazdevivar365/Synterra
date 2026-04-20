import 'server-only';

import type Stripe from 'stripe';

import { createStripeClient } from '@synterra/billing';

let _instance: Stripe | undefined;

function getInstance(): Stripe {
  if (!_instance) {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error('STRIPE_SECRET_KEY env var is not set');
    _instance = createStripeClient(key);
  }
  return _instance;
}

// Proxy so call sites (stripe.checkout, stripe.customers, …) work unchanged.
// Lazy init: the Stripe client is created on first property access, not at
// import time — this prevents Next.js build-time module evaluation from
// failing when STRIPE_SECRET_KEY is only available in the runtime container.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver): unknown {
    return Reflect.get(getInstance(), prop, receiver);
  },
});
