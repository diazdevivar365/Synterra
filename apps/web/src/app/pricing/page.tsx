import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pricing' };

const PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 49,
    description: 'For solo brand managers and small teams getting started.',
    features: [
      '1,000 credits / month',
      '3 seats',
      '1 workspace',
      'Brand monitoring',
      'Email alerts',
      'API access',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    slug: 'growth',
    name: 'Growth',
    price: 199,
    description: 'For growing teams that need more signal and more seats.',
    features: [
      '8,000 credits / month',
      '10 seats',
      '3 workspaces',
      'Everything in Starter',
      'Slack integration',
      'Weekly Brand Pulse digest',
      'Competitor monitoring',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    slug: 'scale',
    name: 'Scale',
    price: 499,
    description: 'For large teams requiring audit trails and advanced controls.',
    features: [
      '30,000 credits / month',
      '25 seats',
      'Unlimited workspaces',
      'Everything in Growth',
      'Audit log',
      'Priority support',
      'Custom Aquila limits',
      'SSO / SAML (WorkOS)',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
] as const;

export default function PricingPage() {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h1 className="text-fg mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-fg mx-auto max-w-xl text-lg">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.highlight
                  ? 'border-brand-500 bg-surface shadow-brand-900/20 shadow-xl'
                  : 'border-border bg-surface'
              }`}
            >
              {plan.highlight && (
                <div className="bg-brand-500 text-fg absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold">
                  Most popular
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-fg mb-1 text-xl font-semibold">{plan.name}</h2>
                <p className="text-muted-fg text-sm">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="text-fg text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-fg text-sm"> / month</span>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <svg
                      className="text-brand-400 mt-0.5 h-4 w-4 shrink-0"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 8l3.5 3.5L13 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-fg text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/workspaces"
                className={`block rounded-lg px-6 py-3 text-center text-sm font-medium transition-colors ${
                  plan.highlight
                    ? 'bg-brand-500 text-fg hover:bg-brand-400'
                    : 'border-border bg-surface text-fg hover:border-brand-500 border'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="border-border bg-surface mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border p-8 sm:flex-row">
          <div>
            <h3 className="text-fg font-semibold">Enterprise</h3>
            <p className="text-muted-fg text-sm">
              Custom credits, dedicated infrastructure, DPA, and SLA. Contact us for a quote.
            </p>
          </div>
          <a
            href="mailto:sales@forgentic.io"
            className="border-border text-fg hover:border-brand-500 shrink-0 rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
          >
            Contact sales
          </a>
        </div>

        <p className="text-muted-fg mt-12 text-center text-xs">
          All prices in USD. Annual billing available — save 20%.{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{' '}
          ·{' '}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </main>
  );
}
