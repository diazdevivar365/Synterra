'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type SyntheticEvent } from 'react';

import { startOnboarding } from '../../../actions/onboarding.js';

interface Props {
  siteKey: string;
}

export function StartForm({ siteKey }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      setError('Please complete the captcha.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await startOnboarding(url, turnstileToken);
      if (result.ok) {
        router.push(`/start/${result.inflightId}`);
      } else {
        setError(result.message);
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourcompany.com"
          required
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isPending || !turnstileToken}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? 'Analyzing…' : 'Analyze →'}
        </button>
      </div>

      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={setTurnstileToken}
        onExpire={() => setTurnstileToken(null)}
        options={{ theme: 'dark' }}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
