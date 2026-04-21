'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const COOKIE_NAME = 'cookie_consent';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function getConsent(): string | null {
  if (typeof document === 'undefined') return null;
  const match = new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`).exec(document.cookie);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

function setConsent(value: 'accepted' | 'declined') {
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${MAX_AGE}; path=/; SameSite=Lax`;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept() {
    setConsent('accepted');
    setVisible(false);
  }

  function decline() {
    setConsent('declined');
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white px-4 py-4 shadow-lg sm:flex sm:items-center sm:justify-between sm:px-6">
      <p className="text-sm text-gray-600">
        We use cookies to improve your experience. See our{' '}
        <Link href="/privacy" className="underline hover:text-gray-900">
          Privacy Policy
        </Link>{' '}
        for details.
      </p>
      <div className="mt-3 flex gap-3 sm:ml-6 sm:mt-0 sm:shrink-0">
        <button
          onClick={decline}
          className="rounded border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Decline
        </button>
        <button
          onClick={accept}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
