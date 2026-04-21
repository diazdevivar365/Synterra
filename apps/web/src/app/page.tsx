import Link from 'next/link';

import { version } from '@/lib/version';

import type { ReactNode } from 'react';

interface Feature {
  readonly title: string;
  readonly body: string;
  readonly icon: ReactNode;
}

const features: readonly Feature[] = [
  {
    title: 'Observe',
    body: 'Every mention, review, and shift in market sentiment is captured in real time. Forgentic fuses owned, earned, and competitive signal into one normalized stream.',
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      </svg>
    ),
  },
  {
    title: 'Interpret',
    body: 'Purpose-built models translate raw signal into brand-level narrative. Shifts in share-of-voice, emerging themes, and competitive pressure surface before they hit your dashboards.',
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2Z" />
        <path d="M10 22h4" />
      </svg>
    ),
  },
  {
    title: 'Act',
    body: 'Insight lands where work actually happens — your inbox, your Slack, your campaign tools. Forgentic drafts responses, opens tickets, and keeps a reviewable audit trail for every automated action.',
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="m13 2-3 7h7l-9 13 3-9H5l8-11Z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Decorative background layers — order matters. */}
      <div
        aria-hidden="true"
        className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-40"
      />
      <div
        aria-hidden="true"
        className="bg-hero-glow pointer-events-none absolute inset-x-0 top-0 h-[60vh]"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Wordmark />
          <nav
            aria-label="Primary"
            className="text-muted-fg hidden items-center gap-6 text-sm sm:flex"
          >
            <a
              href="#features"
              className="hover:text-fg focus-visible:text-fg transition-colors focus-visible:outline-none"
            >
              Product
            </a>
            <Link
              href="/changelog"
              className="hover:text-fg focus-visible:text-fg transition-colors focus-visible:outline-none"
            >
              Changelog
            </Link>
            <Link
              href="/sign-in"
              className="border-border bg-surface text-fg hover:border-brand-500 focus-visible:border-brand-500 rounded-md border px-3 py-1.5 transition-colors focus-visible:outline-none"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <span className="border-border bg-surface/60 text-muted-fg mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <span className="bg-brand-400 h-1.5 w-1.5 rounded-full" aria-hidden="true" />
            Now in private preview
          </span>

          <h1 className="from-fg via-fg to-brand-300 max-w-3xl text-balance bg-gradient-to-br bg-clip-text text-5xl font-semibold leading-tight tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            Brand intelligence, on autopilot.
          </h1>

          <p className="text-muted-fg mt-6 max-w-2xl text-balance text-lg sm:text-xl">
            Forgentic watches the market, interprets what matters, and takes action — so your brand
            team can focus on the work that only humans can do.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="#"
              className="bg-brand-500 text-fg shadow-brand-900/30 hover:bg-brand-400 focus-visible:bg-brand-400 inline-flex h-11 items-center justify-center rounded-lg px-6 text-sm font-medium shadow-lg transition-colors focus-visible:outline-none"
              /* CTA destination pinned once marketing ships the request-access form. */
            >
              Request access
            </a>
            <a
              href="#features"
              className="border-border bg-surface text-fg hover:border-brand-500 focus-visible:border-brand-500 inline-flex h-11 items-center justify-center rounded-lg border px-6 text-sm font-medium transition-colors focus-visible:outline-none"
            >
              How it works
            </a>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="pb-24">
          <h2 id="features-heading" className="sr-only">
            Platform capabilities
          </h2>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <li
                key={feature.title}
                className="border-border bg-surface/60 hover:border-brand-500 group relative flex flex-col rounded-xl border p-6 backdrop-blur transition-colors"
              >
                <div className="bg-brand-500/15 text-brand-300 ring-brand-500/30 mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset">
                  {feature.icon}
                </div>
                <h3 className="text-fg text-lg font-semibold tracking-tight">{feature.title}</h3>
                <p className="text-muted-fg mt-2 text-sm leading-relaxed">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="border-border text-muted-fg mt-auto flex flex-col items-start justify-between gap-4 border-t pt-8 text-xs sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Wordmark compact />
            <span aria-hidden="true" className="bg-border h-1 w-1 rounded-full" />
            <span>
              v{version} · &copy; {new Date().getUTCFullYear()} Forgentic. All rights reserved.
            </span>
          </div>
          <ul className="flex items-center gap-6">
            {/* Destinations below are routed in a follow-up milestone. */}
            <li>
              <Link
                href="/privacy"
                className="hover:text-fg focus-visible:text-fg transition-colors focus-visible:outline-none"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="hover:text-fg focus-visible:text-fg transition-colors focus-visible:outline-none"
              >
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/pricing"
                className="hover:text-fg focus-visible:text-fg transition-colors focus-visible:outline-none"
              >
                Pricing
              </Link>
            </li>
          </ul>
        </footer>
      </div>
    </main>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M16 3 3 10v12l13 7 13-7V10L16 3Z" className="text-brand-500" />
        <path d="M12 12h8M12 16h6" className="text-fg" strokeLinecap="round" />
      </svg>
      <span
        className={
          compact
            ? 'text-fg text-sm font-semibold tracking-tight'
            : 'text-fg text-base font-semibold tracking-tight'
        }
      >
        Forgentic
      </span>
    </div>
  );
}
