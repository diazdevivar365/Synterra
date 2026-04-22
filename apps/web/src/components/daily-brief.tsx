'use client';

import { useEffect, useState } from 'react';

interface Props {
  /** The full brief text (we'll render it with a typing effect). */
  text: string;
  /** Optional byline — e.g. "Claude 4.7 · 08:12" */
  byline?: string;
}

/**
 * Daily AI Brief — typed-reveal animation for the AI-generated headline.
 * Renders server-provided text with character-by-character unveil for
 * demo drama. Skips the animation if user prefers reduced motion.
 */
export function DailyBrief({ text, byline }: Props) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(text);
      setDone(true);
      return;
    }
    let i = 0;
    const tick = () => {
      if (i > text.length) {
        setDone(true);
        return;
      }
      setShown(text.slice(0, i));
      i += 1;
      // speed varies: fast on punctuation break, slower mid-word
      const next = /[.?!,;:]/.test(text[i - 1] ?? '') ? 120 : 18;
      setTimeout(tick, next);
    };
    const t = setTimeout(tick, 400);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className="relative overflow-hidden rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_200px_at_0%_0%,rgba(203,53,0,0.08),transparent_70%)]"
      />
      <div className="relative flex items-center gap-2">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-[#cb3500] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#cb3500]" />
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#cb3500]">
          daily brief
        </p>
        {byline && <span className="ml-auto font-mono text-[10px] text-[#4a5464]">{byline}</span>}
      </div>
      <p className="relative mt-4 text-[22px] font-semibold leading-[1.35] tracking-tight text-[#ffffff]">
        {shown}
        {!done && (
          <span className="ml-1 inline-block h-[1.2em] w-[3px] animate-pulse bg-[#cb3500] align-middle" />
        )}
      </p>
    </div>
  );
}
