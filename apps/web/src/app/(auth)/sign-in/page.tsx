import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { initiateSso, sendMagicLink } from './_actions';

interface Props {
  searchParams: Promise<{ sent?: string; error?: string; sso_error?: string; inflight?: string }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

  const { sent, error, sso_error, inflight } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-fg text-2xl font-semibold tracking-tight">Sign in to Forgentic</h1>
        <p className="text-muted-fg text-sm">
          Enter your email and we&apos;ll send you a magic link.
        </p>
      </div>

      {sent && (
        <div className="bg-surface border-border rounded-lg border p-4 text-center text-sm">
          <p className="text-fg font-medium">Check your inbox</p>
          <p className="text-muted-fg mt-1">We sent a sign-in link to your email.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error === 'expired'
            ? 'This link has expired. Request a new one.'
            : 'Something went wrong. Please try again.'}
        </div>
      )}

      {!sent && (
        <form action={sendMagicLink} className="space-y-4">
          <input type="hidden" name="inflight" value={inflight ?? ''} />
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-fg block text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>
          <button
            type="submit"
            className="bg-brand-500 hover:bg-brand-400 text-fg w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Send magic link →
          </button>
        </form>
      )}

      <div className="relative">
        <div className="border-border absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg text-muted-fg px-2">or</span>
        </div>
      </div>

      <form action={initiateSso} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="sso-email" className="text-fg block text-sm font-medium">
            Continue with SSO
          </label>
          <input
            id="sso-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
          />
        </div>
        {sso_error && (
          <p className="text-sm text-red-400">
            {sso_error === 'not_found'
              ? 'No SSO connection found for this email domain.'
              : 'Invalid email address.'}
          </p>
        )}
        <button
          type="submit"
          className="border-border bg-surface hover:bg-surface/80 text-fg w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Sign in with SSO →
        </button>
      </form>
    </div>
  );
}
