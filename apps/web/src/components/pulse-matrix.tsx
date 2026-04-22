'use client';

import Link from 'next/link';
import { useMemo } from 'react';

export interface PulseNode {
  id: string;
  name: string;
  domain: string;
  score: number; // 0-100
  lastScannedHoursAgo: number | null; // null = never
  hasAlert?: boolean;
}

interface Props {
  nodes: PulseNode[];
  workspaceSlug: string;
}

// Deterministic pseudo-random from string
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * Pulse Matrix — an ambient visualization of every brand in the workspace.
 * Each cell = a brand, coloured by health score, pulsing based on how recently
 * it was scanned (fresh → fast pulse, stale → slow fade).
 *
 * Deterministic layout via string hash so cells keep their position across
 * renders. Hover surfaces the name; click routes to brand detail.
 */
export function PulseMatrix({ nodes, workspaceSlug }: Props) {
  const cells = useMemo(() => {
    const cols = 14;
    const totalSlots = cols * 6; // 6 rows
    // Distribute nodes across grid via hash
    const taken = new Set<number>();
    const placed: (PulseNode & { col: number; row: number })[] = [];
    for (const n of nodes) {
      let slot = Math.floor(hash(n.id) * totalSlots);
      let tries = 0;
      while (taken.has(slot) && tries < totalSlots) {
        slot = (slot + 1) % totalSlots;
        tries++;
      }
      taken.add(slot);
      placed.push({ ...n, col: slot % cols, row: Math.floor(slot / cols) });
    }
    return { cells: placed, cols, rows: 6, taken };
  }, [nodes]);

  const colorFor = (score: number): string => {
    if (score >= 70) return '#59a993'; // green
    if (score >= 40) return '#cb3500'; // brand orange
    if (score > 0) return '#ed6d40'; // danger
    return '#23282f'; // inert
  };

  const pulseFor = (hoursAgo: number | null): string => {
    if (hoursAgo === null) return '8s';
    if (hoursAgo < 2) return '1.6s';
    if (hoursAgo < 12) return '3s';
    if (hoursAgo < 48) return '5s';
    return '8s';
  };

  return (
    <div className="relative overflow-hidden rounded-[.75rem] border border-[#1b1b1b] bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#0e0707] p-6">
      {/* gradient sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_250px_at_50%_0%,rgba(203,53,0,0.14),transparent_70%)]"
      />

      {/* header */}
      <div className="relative flex items-end justify-between border-b border-[#1b1b1b] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
            brand pulse · live
          </p>
          <h3 className="mt-1 text-[22px] font-bold tracking-tight text-[#ffffff]">
            Intelligence Surface
          </h3>
        </div>
        <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888888]">
          <Legend color="#59a993" label="healthy" />
          <Legend color="#cb3500" label="active" />
          <Legend color="#ed6d40" label="at risk" />
          <Legend color="#23282f" label="dormant" />
        </div>
      </div>

      {/* grid */}
      <div
        className="relative mt-8 grid gap-[6px]"
        style={{
          gridTemplateColumns: `repeat(${cells.cols}, 1fr)`,
          gridAutoRows: '44px',
        }}
      >
        {Array.from({ length: cells.cols * cells.rows }).map((_, idx) => {
          const cell = cells.cells.find((c) => c.col + c.row * cells.cols === idx);
          if (!cell) {
            return (
              <div
                key={`empty-${idx}`}
                className="rounded-[3px] border border-[#1b1b1b] bg-[#0a0a0a]/40"
              />
            );
          }
          const color = colorFor(cell.score);
          const duration = pulseFor(cell.lastScannedHoursAgo);
          return (
            <Link
              key={cell.id}
              href={`/${workspaceSlug}/brands/${cell.id}`}
              className="group relative overflow-hidden rounded-[3px] border border-[#1b1b1b] bg-[#0e0e0e] transition-all duration-300 hover:scale-[1.08] hover:border-[#cb3500] hover:shadow-[0_0_20px_rgba(203,53,0,0.35)]"
              title={`${cell.name} · ${cell.score}`}
            >
              <span
                aria-hidden
                className="pulse absolute inset-0"
                style={
                  {
                    '--pulse-color': color,
                    animationDuration: duration,
                  } as React.CSSProperties
                }
              />
              {cell.hasAlert && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ed6d40] shadow-[0_0_6px_rgba(237,109,64,0.9)]"
                />
              )}
              <span className="relative z-10 flex h-full items-center justify-center px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#ffffff] opacity-0 transition-opacity group-hover:opacity-100">
                {cell.domain.replace(/^www\./, '').slice(0, 10)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* footer count */}
      <div className="mt-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[#4a5464]">
        <span>{cells.cells.length} brands active</span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#cb3500]" /> scan in
          progress
        </span>
      </div>

      <style>{`
        .pulse {
          background: radial-gradient(circle at center, var(--pulse-color) 0%, transparent 60%);
          animation: pulse-anim ease-in-out infinite;
          opacity: 0.6;
        }
        @keyframes pulse-anim {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        aria-hidden
      />
      {label}
    </span>
  );
}
