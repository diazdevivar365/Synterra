'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { demoLoginAction, initiateSso, sendMagicLink } from './_actions';

type Tab = 'demo' | 'magic' | 'sso';

interface Props {
  initialTab: Tab;
  sent: boolean;
  error: string | undefined;
  ssoError: string | undefined;
  demoEnabled: boolean;
}

export function SignInPanel({ initialTab, sent, error, ssoError, demoEnabled }: Props) {
  const [tab, setTab] = useState<Tab>(
    demoEnabled ? initialTab : initialTab === 'demo' ? 'magic' : initialTab,
  );
  const [pending, startTransition] = useTransition();

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'demo', label: 'Demo', show: demoEnabled },
    { id: 'magic', label: 'Magic link', show: true },
    { id: 'sso', label: 'SSO', show: true },
  ];

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <header className="mb-10">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a5464]">
          access
        </p>
        <h2 className="text-[40px] font-bold leading-[1.05] tracking-tight text-[#ffffff]">
          Sign in to
          <br />
          <span className="bg-gradient-to-r from-[#cb3500] to-[#ed6d40] bg-clip-text text-transparent">
            Forgentic
          </span>
        </h2>
        <p className="mt-3 text-[14px] text-[#888888]">
          Choose how you want to enter. Demo mode provisions a workspace instantly.
        </p>
      </header>

      {sent && tab === 'magic' && (
        <Banner
          kind="success"
          title="Check your inbox"
          body="We just sent you a one-time sign-in link. It expires in 15 minutes."
        />
      )}
      {error && (
        <Banner
          kind="error"
          title="Something went wrong"
          body={
            error === 'expired'
              ? 'That link has expired. Request a new one.'
              : 'Try again or switch method.'
          }
        />
      )}

      {/* Tabs */}
      <nav className="mb-6 flex items-center gap-1 rounded-[.5rem] border border-[#1b1b1b] bg-[#0a0a0a] p-1">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-[.3rem] px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                tab === t.id
                  ? 'bg-[#1b1b1b] text-[#ffffff] shadow-[inset_0_0_0_1px_rgba(203,53,0,0.3)]'
                  : 'text-[#888888] hover:text-[#dadada]'
              }`}
            >
              {t.label}
            </button>
          ))}
      </nav>

      {/* Panels */}
      {tab === 'demo' && demoEnabled && (
        <form action={(fd) => startTransition(() => demoLoginAction(fd))} className="space-y-5">
          <Field
            id="demo-email"
            label="Your email (any)"
            name="email"
            placeholder="you@company.com"
            defaultValue="demo@forgentic.io"
            hint="No password. We'll spin up a demo workspace tied to this email."
          />
          <PrimaryButton pending={pending}>
            <span>Enter Forgentic</span>
            <ArrowGlyph />
          </PrimaryButton>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
            · dev bypass · zero friction ·
          </p>
        </form>
      )}

      {tab === 'magic' && (
        <form action={(fd) => startTransition(() => sendMagicLink(fd))} className="space-y-5">
          <Field
            id="magic-email"
            label="Work email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            hint="We'll send you a one-time link. No password required."
          />
          <PrimaryButton pending={pending}>
            <span>Send magic link</span>
            <ArrowGlyph />
          </PrimaryButton>
        </form>
      )}

      {tab === 'sso' && (
        <form action={(fd) => startTransition(() => initiateSso(fd))} className="space-y-5">
          {ssoError && (
            <Banner
              kind="error"
              title={ssoError === 'not_found' ? 'No SSO connection' : 'Invalid email'}
              body={
                ssoError === 'not_found'
                  ? 'Your domain is not connected yet. Ask your admin or use magic link.'
                  : 'Use a valid work email.'
              }
            />
          )}
          <Field
            id="sso-email"
            label="Work email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            hint="We match your email domain against a registered SSO connection (WorkOS / Google / Github)."
          />
          <SecondaryButton pending={pending}>
            <span>Continue with SSO</span>
            <ArrowGlyph />
          </SecondaryButton>
          <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-[#4a5464]">
            <IdpDot label="WorkOS" />
            <IdpDot label="Google" />
            <IdpDot label="GitHub" />
          </div>
        </form>
      )}

      <p className="mt-8 text-center text-[12px] text-[#4a5464]">
        By continuing you agree to our{' '}
        <Link
          className="text-[#888888] underline-offset-4 hover:text-[#dadada] hover:underline"
          href="/terms"
        >
          terms
        </Link>{' '}
        &{' '}
        <Link
          className="text-[#888888] underline-offset-4 hover:text-[#dadada] hover:underline"
          href="/privacy"
        >
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}

// ── subcomponents ──────────────────────────────────────────────────────────

function Field({
  id,
  label,
  name,
  type = 'email',
  placeholder,
  defaultValue,
  required,
  hint,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[#888888]"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete="email"
        placeholder={placeholder}
        className="w-full rounded-[.35rem] border border-[#1b1b1b] bg-[#0a0a0a] px-4 py-3 text-[15px] text-[#ffffff] transition-colors placeholder:text-[#4a5464] focus:border-[#cb3500] focus:outline-none focus:ring-[3px] focus:ring-[#cb3500]/20"
      />
      {hint && <p className="text-[12px] leading-relaxed text-[#4a5464]">{hint}</p>}
    </div>
  );
}

function PrimaryButton({ children, pending }: { children: React.ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[.35rem] bg-[#cb3500] text-[15px] font-semibold text-[#ffffff] shadow-[0_0_30px_rgba(203,53,0,0.35)] transition-all duration-300 hover:bg-[#ed6d40] hover:shadow-[0_0_40px_rgba(203,53,0,0.55)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      {pending ? <Spinner /> : children}
    </button>
  );
}

function SecondaryButton({ children, pending }: { children: React.ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-[.35rem] border border-[#535353] bg-[#111111] text-[15px] font-medium text-[#ffffff] transition-all duration-200 hover:border-[#cb3500] hover:bg-[#1b1b1b] hover:text-[#cb3500] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? <Spinner /> : children}
    </button>
  );
}

function ArrowGlyph() {
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

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12A9 9 0 0 0 12 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IdpDot({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono uppercase tracking-[0.2em]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#535353]" aria-hidden />
      {label}
    </span>
  );
}

function Banner({ kind, title, body }: { kind: 'success' | 'error'; title: string; body: string }) {
  const palette =
    kind === 'success'
      ? 'border-[#59a993]/40 bg-[#59a993]/10 text-[#a3d4c4]'
      : 'border-[#cb3500]/40 bg-[#cb3500]/10 text-[#f0b89a]';
  return (
    <div className={`mb-6 rounded-[.35rem] border p-4 ${palette}`}>
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="mt-1 text-[12px] opacity-80">{body}</p>
    </div>
  );
}
