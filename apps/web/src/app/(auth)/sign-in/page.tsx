import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { SignInPanel } from './sign-in-panel';

interface Props {
  searchParams: Promise<{ sent?: string; error?: string; sso_error?: string; tab?: string }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

  const { sent, error, sso_error, tab } = await searchParams;
  const initialTab = tab === 'magic' || tab === 'sso' ? tab : 'demo';
  const demoEnabled = !!process.env['DEV_AUTO_LOGIN_SECRET'];

  return (
    <div className="relative grid min-h-dvh grid-cols-1 overflow-hidden lg:grid-cols-[1.15fr_1fr]">
      {/* ── Left hero ─────────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden border-r border-[#1b1b1b] lg:flex lg:flex-col lg:justify-between">
        {/* layered gradients */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_400px_at_20%_20%,rgba(203,53,0,0.22),transparent_70%),radial-gradient(800px_500px_at_80%_80%,rgba(92,147,159,0.14),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
        />
        {/* noise grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* header */}
        <header className="relative z-10 flex items-center justify-between px-12 py-10">
          <Link href="/" className="group flex items-center gap-3">
            <svg
              viewBox="0 0 32 32"
              className="h-9 w-9 transition-transform duration-300 group-hover:rotate-12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 3 L29 10 V22 L16 29 L3 22 V10 Z" className="text-[#cb3500]" />
              <path
                d="M12 12 H20 M12 16 H24 M12 20 H18"
                className="text-[#ffffff]"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[20px] font-bold tracking-tight">forgentic</span>
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4a5464]">
            v0.1 · early access
          </span>
        </header>

        {/* pitch */}
        <div className="relative z-10 flex-1 px-12">
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-[#1b1b1b] bg-[#0a0a0a]/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#dadada] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#cb3500]" aria-hidden />
            intelligence engine online
          </div>
          <h1 className="mt-8 max-w-[640px] bg-gradient-to-b from-[#ffffff] via-[#ffffff] to-[#888888] bg-clip-text text-[64px] font-bold leading-[0.95] tracking-tight text-transparent lg:text-[84px]">
            See the market
            <br />
            <span className="bg-gradient-to-r from-[#cb3500] to-[#ed6d40] bg-clip-text text-transparent">
              before it moves.
            </span>
          </h1>
          <p className="mt-8 max-w-[520px] text-[17px] leading-relaxed text-[#888888]">
            Forgentic watches your market in real time, interprets what matters, and drafts the
            moves your team should make next. Built on a data plane that refuses to miss.
          </p>

          {/* stat row */}
          <dl className="mt-14 grid max-w-[520px] grid-cols-3 gap-6">
            {[
              { v: '888', k: 'brands tracked' },
              { v: '21', k: 'signal pipelines' },
              { v: '< 30s', k: 'scan → insight' },
            ].map(({ v, k }) => (
              <div key={k} className="border-l border-[#1b1b1b] pl-4">
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#4a5464]">
                  {k}
                </dt>
                <dd className="mt-2 text-[28px] font-bold tracking-tight text-[#ffffff]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* footer */}
        <footer className="relative z-10 flex items-center justify-between px-12 py-10 font-mono text-[11px] text-[#4a5464]">
          <span>© {new Date().getFullYear()} forgentic core · buenos aires</span>
          <span className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#59a993]" aria-hidden /> all systems green
          </span>
        </footer>
      </aside>

      {/* ── Right panel ───────────────────────────────────────────────── */}
      <section className="relative flex min-h-dvh flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        {/* mobile-only top bar */}
        <div className="mb-10 flex items-center justify-between lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <svg
              viewBox="0 0 32 32"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M16 3 L29 10 V22 L16 29 L3 22 V10 Z" className="text-[#cb3500]" />
              <path d="M12 12 H20 M12 16 H24" className="text-[#ffffff]" strokeLinecap="round" />
            </svg>
            <span className="font-bold tracking-tight">forgentic</span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#4a5464]">
            sign in
          </span>
        </div>

        <SignInPanel
          initialTab={initialTab}
          sent={Boolean(sent)}
          error={error}
          ssoError={sso_error}
          demoEnabled={demoEnabled}
        />
      </section>
    </div>
  );
}
