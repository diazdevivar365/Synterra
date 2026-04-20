'use client';

import { useEffect, useRef } from 'react';

import { polarToCartesian, radarPolygonPoints } from '@/lib/brand-utils';

export interface DnaScores {
  voiceClarity: number;
  toneConsistency: number;
  marketPresence: number;
  competitivePosition: number;
  audienceAlignment: number;
  visualIdentity: number;
}

interface Props {
  scores: DnaScores;
  size?: number;
}

const DIMENSIONS = [
  'Voice Clarity',
  'Tone Consistency',
  'Market Presence',
  'Competitive Position',
  'Audience Alignment',
  'Visual Identity',
] as const;

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = 110;
const LABEL_R = 140;
const LEVELS = 4;
const N = 6;

export function DnaRadar({ scores, size = SIZE }: Props) {
  const polygonRef = useRef<SVGPolygonElement>(null);

  const scoreArray: number[] = [
    scores.voiceClarity,
    scores.toneConsistency,
    scores.marketPresence,
    scores.competitivePosition,
    scores.audienceAlignment,
    scores.visualIdentity,
  ];

  useEffect(() => {
    const el = polygonRef.current;
    if (!el || typeof el.animate !== 'function') return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 600,
      easing: 'ease-out',
      fill: 'forwards',
    });
  }, []);

  const gridPolygons = Array.from({ length: LEVELS }, (_, level) => {
    const r = (MAX_R * (level + 1)) / LEVELS;
    return Array.from({ length: N }, (_, i) => {
      const { x, y } = polarToCartesian(CX, CY, r, i, N);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  });

  const spokes = Array.from({ length: N }, (_, i) =>
    polarToCartesian(CX, CY, MAX_R, i, N),
  );

  const labels = DIMENSIONS.map((label, i) => {
    const { x, y } = polarToCartesian(CX, CY, LABEL_R, i, N);
    return { label, x, y };
  });

  const dataPoints = radarPolygonPoints(scoreArray, CX, CY, MAX_R);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-label="Brand DNA Radar"
      role="img"
    >
      {gridPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#1b1b1b" strokeWidth="1" />
      ))}

      {spokes.map(({ x, y }, i) => (
        <line
          key={i}
          x1={CX}
          y1={CY}
          x2={x.toFixed(2)}
          y2={y.toFixed(2)}
          stroke="#1b1b1b"
          strokeWidth="1"
        />
      ))}

      <polygon
        ref={polygonRef}
        data-testid="radar-data"
        points={dataPoints}
        fill="rgba(203,53,0,0.15)"
        stroke="#cb3500"
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ opacity: 0 }}
      />

      {labels.map(({ label, x, y }) => {
        const anchor = x < CX - 4 ? 'end' : x > CX + 4 ? 'start' : 'middle';
        const dy = y < CY ? -6 : y > CY + 4 ? 14 : 5;
        return (
          <text
            key={label}
            x={x.toFixed(2)}
            y={(y + dy).toFixed(2)}
            textAnchor={anchor}
            fontSize="10"
            fontFamily="var(--font-geist-mono, monospace)"
            fill="#4a5464"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
