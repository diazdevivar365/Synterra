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
        strokeWidth="1.5"
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
        strokeWidth="1.5"
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
        strokeWidth="1.5"
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
    <main className="relative min-h-dvh overflow-hidden bg-[#000000] font-sans text-[#ffffff]">
      {/* Premium Background Effects */}
      <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute left-1/2 top-[-20%] h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[#cb3500]/20 blur-[120px]" />

      <div className="relative mx-auto flex min-h-dvh max-w-[1200px] flex-col px-6 py-10 sm:px-8 lg:px-12">
        <header className="z-10 flex items-center justify-between">
          <Wordmark />
          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 text-[14px] font-medium text-[#dadada] sm:flex"
          >
            <a href="#features" className="transition-colors hover:text-[#ffffff]">
              Platform
            </a>
            <Link href="/changelog" className="transition-colors hover:text-[#ffffff]">
              Intelligence
            </Link>
            <Link
              href="/sign-in"
              className="rounded-[.25rem] border border-[#535353] bg-transparent px-[16px] py-[8px] text-[#ffffff] transition-all hover:border-[#cb3500] hover:text-[#cb3500] hover:shadow-[0_0_15px_rgba(203,53,0,0.3)]"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <section className="animate-fade-in-up z-10 flex flex-1 flex-col items-center justify-center py-32 text-center">
          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#535353] bg-[#111111]/80 px-4 py-1.5 font-mono text-[12px] text-[#dadada] shadow-[0_0_20px_rgba(203,53,0,0.1)] backdrop-blur-md">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#cb3500]" aria-hidden="true" />
            FORGENTIC ENGINE ONLINE
          </div>

          <h1 className="mb-8 max-w-[900px] bg-gradient-to-b from-[#ffffff] to-[#888888] bg-clip-text text-6xl font-bold leading-[1.1] tracking-tight text-transparent sm:text-7xl lg:text-[88px]">
            Brand intelligence,
            <br />
            <span className="bg-gradient-to-r from-[#cb3500] to-[#ed6d40] bg-clip-text text-transparent">
              on autopilot.
            </span>
          </h1>

          <p className="mb-12 max-w-2xl text-[18px] leading-relaxed text-[#888888] sm:text-[20px]">
            Forgentic watches the market, interprets what matters, and takes action — so your brand
            team can focus on the work that only humans can do.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <a
              href="#"
              className="inline-flex h-12 transform items-center justify-center rounded-[.25rem] bg-[#cb3500] px-8 text-[15px] font-bold text-[#ffffff] shadow-[0_0_30px_rgba(203,53,0,0.4)] transition-all hover:scale-105 hover:bg-[#ed6d40]"
            >
              Initialize Workspace
            </a>
            <a
              href="#features"
              className="inline-flex h-12 items-center justify-center rounded-[.25rem] border border-[#535353] bg-[#111111] px-8 text-[15px] font-medium text-[#ffffff] transition-colors hover:border-[#dadada]"
            >
              Explore capabilities
            </a>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="z-10 pb-32">
          <h2 id="features-heading" className="sr-only">
            Platform capabilities
          </h2>
          <ul className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <li
                key={feature.title}
                className="group relative flex flex-col rounded-[.75rem] border border-[#535353] bg-[#111111]/60 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#cb3500] hover:bg-[#1b1b1b] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-6 text-[#cb3500] transition-transform duration-300 group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-[20px] font-bold tracking-tight text-[#ffffff]">
                  {feature.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-[#888888]">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="z-10 mt-auto flex flex-col items-start justify-between gap-4 border-t border-[#535353] py-8 font-mono text-[13px] text-[#888888] sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Wordmark compact />
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#535353]" />
            <span>
              v{version} · &copy; {new Date().getUTCFullYear()} Forgentic Core.
            </span>
          </div>
          <ul className="flex items-center gap-8">
            <li>
              <Link href="/privacy" className="transition-colors hover:text-[#ffffff]">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="transition-colors hover:text-[#ffffff]">
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/status"
                className="flex items-center gap-2 transition-colors hover:text-[#cb3500]"
              >
                <span className="h-2 w-2 rounded-full bg-[#59a993]"></span>System Status
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
    <div className="flex items-center gap-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M16 3 3 10v12l13 7 13-7V10L16 3Z" className="text-[#cb3500]" />
        <path d="M12 12h8M12 16h6" className="text-[#ffffff]" strokeLinecap="round" />
      </svg>
      <span
        className={`font-bold tracking-tight text-[#ffffff] ${compact ? 'text-[16px]' : 'text-[22px]'}`}
      >
        Forgentic
      </span>
    </div>
  );
}
