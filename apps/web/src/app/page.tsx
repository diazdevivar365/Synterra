import Link from 'next/link';

import { version } from '@/lib/version';

import type { ReactNode } from 'react';

// ── Landing copy (marketing-owned; replace via CMS once wired) ───────────────
const features: readonly { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Detect',
    body: 'Visual, copy, pricing, and tech-stack changes on every competitor you track — surfaced the moment they happen, not a week later in a weekly digest.',
    icon: <IconObserve />,
  },
  {
    title: 'Interpret',
    body: 'Two LLMs reason in parallel over the same raw signal. Disagreements flag themselves. You get the narrative, not the noise.',
    icon: <IconInterpret />,
  },
  {
    title: 'Respond',
    body: 'From detection to a reviewable creative brief — same platform, same loop. Slack alert, briefing PDF, campaign draft. One flywheel.',
    icon: <IconAct />,
  },
];

const comparison = [
  {
    cap: 'Competitor visual change detection',
    us: '✓ AI-automated',
    semrush: '—',
    brandwatch: '—',
    jasper: '—',
  },
  {
    cap: 'Knowledge graph (brands × tech × tags)',
    us: '✓ Neo4j live graph',
    semrush: '—',
    brandwatch: '—',
    jasper: '—',
  },
  {
    cap: 'From monitoring → creative brief',
    us: '✓ Core loop',
    semrush: '—',
    brandwatch: '—',
    jasper: 'Brief only',
  },
  {
    cap: 'Multi-LLM ensemble reasoning',
    us: '✓ Claude + Gemini',
    semrush: '—',
    brandwatch: '—',
    jasper: 'Single model',
  },
  {
    cap: 'Real-time competitor alerts',
    us: '✓ Slack · webhook',
    semrush: 'Weekly email',
    brandwatch: 'Mentions only',
    jasper: '—',
  },
  {
    cap: 'SEO + traffic analytics',
    us: 'Roadmap · Q3',
    semrush: '✓ Best-in-class',
    brandwatch: 'Partial',
    jasper: '—',
  },
  {
    cap: 'Mid-market team pricing',
    us: '$299 – $799/mo',
    semrush: '$499 – $999/mo',
    brandwatch: '$1,000+/mo',
    jasper: '$59 – $149/mo',
  },
];

const gaps = [
  'Deep social monitoring (Twitter · YouTube · TikTok) — scraping solid, APIs pending',
  'Sentiment on social posts — in pipeline, not live',
  'SEO + keyword ranking — out of scope, brand positioning first',
  'Video / ad-creative AI analysis — designed, compute budget pending',
  'SOC2 compliance — 3–4 months out before enterprise contracts',
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#000000] font-sans text-[#ffffff]">
      <AmbientBackground />

      <div className="relative mx-auto flex min-h-dvh max-w-[1280px] flex-col px-6 py-8 sm:px-8 lg:px-12">
        <NavBar />

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="relative z-10 flex flex-1 flex-col items-center justify-center py-24 text-center sm:py-32">
          <Badge>
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#cb3500] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#cb3500]" />
            </span>
            INTELLIGENCE ENGINE ONLINE
          </Badge>

          <h1 className="mb-8 max-w-[960px] bg-gradient-to-b from-[#ffffff] via-[#ffffff] to-[#888888] bg-clip-text text-6xl font-bold leading-[0.98] tracking-tight text-transparent sm:text-7xl lg:text-[104px]">
            See the market
            <br />
            <span className="bg-gradient-to-r from-[#cb3500] via-[#ed6d40] to-[#cb3500] bg-clip-text text-transparent">
              before it moves.
            </span>
          </h1>

          <p className="mb-12 max-w-[640px] text-[18px] leading-relaxed text-[#888888] sm:text-[20px]">
            Competitive intelligence + creative response, in one loop. Semrush tells you your
            competitor's keywords. Brandwatch tells you people mentioned them. Jasper helps you
            write copy. We connect all three.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/sign-in"
              className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-[.3rem] bg-[#cb3500] px-8 text-[15px] font-bold text-[#ffffff] shadow-[0_0_40px_rgba(203,53,0,0.4)] transition-all duration-300 hover:bg-[#ed6d40] hover:shadow-[0_0_60px_rgba(203,53,0,0.6)]"
            >
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              <span>Enter workspace</span>
              <ArrowRight />
            </Link>
            <a
              href="#comparison"
              className="inline-flex h-12 items-center justify-center rounded-[.3rem] border border-[#535353] bg-[#0a0a0a] px-8 text-[15px] font-medium text-[#ffffff] transition-colors hover:border-[#dadada]"
            >
              Why not just use Semrush?
            </a>
          </div>

          {/* stat row */}
          <dl className="mx-auto mt-20 grid max-w-[720px] grid-cols-3 gap-10 border-t border-[#1b1b1b] pt-10">
            {[
              { v: '888', k: 'brands live in graph' },
              { v: '21', k: 'signal pipelines' },
              { v: '< 30s', k: 'scan → insight' },
            ].map(({ v, k }) => (
              <div key={k} className="text-center">
                <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
                  {k}
                </dt>
                <dd className="mt-2 text-[32px] font-bold tracking-tight text-[#ffffff]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Capabilities (3-col) ────────────────────────────────────── */}
        <section id="features" aria-labelledby="features-heading" className="relative z-10 py-24">
          <h2 id="features-heading" className="sr-only">
            The Forgentic loop
          </h2>
          <div className="mb-12 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a5464]">
              the loop
            </p>
            <h3 className="mt-2 text-[42px] font-bold tracking-tight text-[#ffffff]">
              Detect · Interpret · Respond
            </h3>
          </div>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <li
                key={f.title}
                className="group relative overflow-hidden rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#cb3500]/60 hover:shadow-[0_10px_40px_rgba(203,53,0,0.15)]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(300px_150px_at_50%_0%,rgba(203,53,0,0.08),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <p className="relative mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
                  0{i + 1}
                </p>
                <div className="relative mb-6 text-[#cb3500] transition-transform duration-300 group-hover:scale-110">
                  {f.icon}
                </div>
                <h3 className="relative mb-3 text-[22px] font-bold tracking-tight text-[#ffffff]">
                  {f.title}
                </h3>
                <p className="relative text-[14px] leading-relaxed text-[#888888]">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Comparison ──────────────────────────────────────────────── */}
        <section id="comparison" className="relative z-10 py-24">
          <div className="mb-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a5464]">moat</p>
            <h3 className="mt-2 max-w-[720px] text-[42px] font-bold leading-[1.05] tracking-tight text-[#ffffff]">
              Nobody else connects
              <br />
              <span className="bg-gradient-to-r from-[#cb3500] to-[#ed6d40] bg-clip-text text-transparent">
                monitor → interpret → respond.
              </span>
            </h3>
          </div>

          <div className="overflow-hidden rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a]">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#1b1b1b] bg-[#050505]">
                    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a5464]">
                      Capability
                    </th>
                    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#cb3500]">
                      Forgentic
                    </th>
                    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a5464]">
                      Semrush
                    </th>
                    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a5464]">
                      Brandwatch
                    </th>
                    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a5464]">
                      Jasper
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr
                      key={row.cap}
                      className="border-b border-[#1b1b1b] transition-colors last:border-0 hover:bg-[#0e0e0e]"
                    >
                      <td className="px-4 py-4 text-[14px] text-[#dadada]">{row.cap}</td>
                      <td className="px-4 py-4 text-[14px] font-semibold text-[#ffffff]">
                        <span className="rounded-[.25rem] border border-[#cb3500]/30 bg-[#cb3500]/10 px-2 py-1 text-[13px] text-[#f0b89a]">
                          {row.us}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[13px] text-[#888888]">{row.semrush}</td>
                      <td className="px-4 py-4 text-[13px] text-[#888888]">{row.brandwatch}</td>
                      <td className="px-4 py-4 text-[13px] text-[#888888]">{row.jasper}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-8 max-w-[640px] text-[15px] leading-relaxed text-[#888888]">
            Every new client adds brands to the shared knowledge graph. Every new brand makes the
            intelligence richer for everyone. A $12B+ market growing 18% YoY, sitting at the
            intersection of competitive intelligence and AI-native creative tooling.
          </p>
        </section>

        {/* ── Transparency / Roadmap ─────────────────────────────────── */}
        <section className="relative z-10 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a5464]">
                honest roadmap
              </p>
              <h3 className="mt-2 text-[36px] font-bold leading-[1.1] tracking-tight text-[#ffffff]">
                What we're still building
              </h3>
              <p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-[#888888]">
                We have the architecture right. What's missing is six months of focused execution
                and infrastructure investment. No vaporware — here's the punch list.
              </p>
            </div>
            <ul className="space-y-3">
              {gaps.map((g, i) => (
                <li
                  key={i}
                  className="flex items-start gap-4 rounded-[.5rem] border border-[#1b1b1b] bg-[#0a0a0a] p-5 transition-colors hover:border-[#1b1b1b]"
                >
                  <span className="mt-1 font-mono text-[10px] text-[#4a5464]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-[14px] leading-relaxed text-[#dadada]">{g}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <section className="relative z-10 py-24 text-center">
          <h3 className="mx-auto max-w-[720px] text-[48px] font-bold leading-[1.05] tracking-tight text-[#ffffff]">
            The intelligence flywheel
            <br />
            <span className="bg-gradient-to-r from-[#cb3500] to-[#ed6d40] bg-clip-text text-transparent">
              is already spinning.
            </span>
          </h3>
          <p className="mx-auto mt-6 max-w-[480px] text-[15px] leading-relaxed text-[#888888]">
            Two products, one data plane. Every client makes the platform smarter for everyone.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/sign-in"
              className="group inline-flex h-12 items-center gap-2 rounded-[.3rem] bg-[#cb3500] px-8 text-[15px] font-bold text-[#ffffff] shadow-[0_0_40px_rgba(203,53,0,0.4)] transition-all hover:bg-[#ed6d40] hover:shadow-[0_0_60px_rgba(203,53,0,0.6)]"
            >
              <span>Join the workspace</span>
              <ArrowRight />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-[.3rem] border border-[#535353] bg-[#0a0a0a] px-8 text-[15px] font-medium text-[#ffffff] transition-colors hover:border-[#dadada]"
            >
              See pricing
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────────

function AmbientBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.12] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-[#cb3500]/20 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[40%] h-[500px] w-[600px] rounded-full bg-[#5c939f]/10 blur-[120px]"
      />
    </>
  );
}

function NavBar() {
  return (
    <header className="z-10 flex items-center justify-between">
      <Wordmark />
      <nav
        aria-label="Primary"
        className="hidden items-center gap-8 text-[14px] font-medium text-[#dadada] sm:flex"
      >
        <a href="#features" className="transition-colors hover:text-[#ffffff]">
          Loop
        </a>
        <a href="#comparison" className="transition-colors hover:text-[#ffffff]">
          Moat
        </a>
        <Link href="/pricing" className="transition-colors hover:text-[#ffffff]">
          Pricing
        </Link>
        <Link href="/changelog" className="transition-colors hover:text-[#ffffff]">
          Changelog
        </Link>
        <Link
          href="/sign-in"
          className="rounded-[.25rem] border border-[#535353] bg-transparent px-[16px] py-[8px] text-[#ffffff] transition-all hover:border-[#cb3500] hover:text-[#cb3500] hover:shadow-[0_0_15px_rgba(203,53,0,0.3)]"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="z-10 mt-auto flex flex-col items-start justify-between gap-4 border-t border-[#1b1b1b] py-8 font-mono text-[12px] text-[#888888] sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <Wordmark compact />
        <span aria-hidden className="h-1 w-1 rounded-full bg-[#535353]" />
        <span>
          v{version} · © {new Date().getUTCFullYear()} Forgentic Core · Buenos Aires
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
            <span className="h-2 w-2 rounded-full bg-[#59a993]" />
            All systems green
          </Link>
        </li>
      </ul>
    </footer>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg
        aria-hidden
        viewBox="0 0 32 32"
        className={compact ? 'h-7 w-7' : 'h-9 w-9'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M16 3 L29 10 V22 L16 29 L3 22 V10 Z" className="text-[#cb3500]" />
        <path
          d="M12 12 H20 M12 16 H24 M12 20 H18"
          className="text-[#ffffff]"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`font-bold tracking-tight text-[#ffffff] ${compact ? 'text-[16px]' : 'text-[22px]'}`}
      >
        Forgentic
      </span>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-[#1b1b1b] bg-[#0a0a0a]/80 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#dadada] shadow-[0_0_20px_rgba(203,53,0,0.1)] backdrop-blur-md">
      {children}
    </div>
  );
}

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function IconObserve() {
  return (
    <svg
      aria-hidden
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
  );
}

function IconInterpret() {
  return (
    <svg
      aria-hidden
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
  );
}

function IconAct() {
  return (
    <svg
      aria-hidden
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
  );
}
