'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { TenantGraph } from '@/lib/graph-tenant';

interface Props {
  graph: TenantGraph;
  workspaceSlug: string;
}

interface Sim {
  id: string;
  label: string;
  group: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

const GROUP_COLOR: Record<number, string> = {
  1: '#22d3ee', // brand
  2: '#a78bfa', // tech
  3: '#f472b6', // social
  4: '#fbbf24', // competitor
  5: '#94a3b8', // other
};

const GROUP_LABEL: Record<number, string> = {
  1: 'Brand',
  2: 'Tech',
  3: 'Social',
  4: 'Competitor',
  5: 'Other',
};

const EDGE_COLOR: Record<string, string> = {
  uses_tech: 'rgba(167,139,250,0.25)',
  has_social: 'rgba(244,114,182,0.25)',
  competes_with: 'rgba(251,191,36,0.35)',
  shares_stack: 'rgba(34,211,238,0.35)',
};

export function TenantGraph({ graph, workspaceSlug }: Props) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeGroups, setActiveGroups] = useState<Set<number>>(
    new Set(Object.keys(GROUP_LABEL).map(Number)),
  );

  const { nodes, edgeList, width, height } = useMemo(() => {
    const W = 1200;
    const H = 720;
    const degree = new Map<string, number>();
    graph.edges.forEach((e) => {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    });

    const sims: Sim[] = graph.nodes.map((n, i) => {
      const angle = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
      const r = 200 + (i % 5) * 40;
      return {
        id: n.id,
        label: n.label,
        group: n.group,
        x: W / 2 + Math.cos(angle) * r,
        y: H / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        degree: degree.get(n.id) ?? 0,
      };
    });

    const idIdx = new Map(sims.map((s, i) => [s.id, i]));
    const edges = graph.edges
      .map((e) => {
        const a = idIdx.get(e.source);
        const b = idIdx.get(e.target);
        if (a === undefined || b === undefined) return null;
        return { a, b, kind: e.kind };
      })
      .filter((e): e is { a: number; b: number; kind: string } => e !== null);

    const REPULSION = 4200;
    const SPRING = 0.015;
    const SPRING_LEN = 90;
    const DAMP = 0.82;
    const CENTER = 0.005;

    for (let step = 0; step < 260; step++) {
      for (let i = 0; i < sims.length; i++) {
        const si = sims[i];
        if (!si) continue;
        for (let j = i + 1; j < sims.length; j++) {
          const sj = sims[j];
          if (!sj) continue;
          const dx = sj.x - si.x;
          const dy = sj.y - si.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = REPULSION / d2;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          si.vx -= fx;
          si.vy -= fy;
          sj.vx += fx;
          sj.vy += fy;
        }
      }
      edges.forEach((e) => {
        const s = sims[e.a];
        const t = sims[e.b];
        if (!s || !t) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const diff = d - SPRING_LEN;
        const fx = (dx / d) * diff * SPRING;
        const fy = (dy / d) * diff * SPRING;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      });
      sims.forEach((s) => {
        s.vx += (W / 2 - s.x) * CENTER;
        s.vy += (H / 2 - s.y) * CENTER;
        s.vx *= DAMP;
        s.vy *= DAMP;
        s.x += s.vx;
        s.y += s.vy;
        s.x = Math.max(20, Math.min(W - 20, s.x));
        s.y = Math.max(20, Math.min(H - 20, s.y));
      });
    }

    return { nodes: sims, edgeList: edges, width: W, height: H };
  }, [graph]);

  useEffect(() => {
    if (!hovered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHovered(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hovered]);

  const toggleGroup = (g: number) => {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const handleNodeClick = (n: Sim) => {
    if (n.group === 1 && n.id.startsWith('brand:')) {
      router.push(`/${workspaceSlug}/brands/${encodeURIComponent(n.id.slice('brand:'.length))}`);
    }
  };

  const nodeById = (id: string) => nodes.find((n) => n.id === id);
  const highlightSet = hovered
    ? new Set<string>([
        hovered,
        ...edgeList
          .filter((e) => nodes[e.a]?.id === hovered || nodes[e.b]?.id === hovered)
          .flatMap((e) => {
            const a = nodes[e.a];
            const b = nodes[e.b];
            return [a?.id, b?.id].filter((x): x is string => typeof x === 'string');
          }),
      ])
    : null;

  return (
    <div className="border-border bg-surface rounded-[8px] border">
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">Filter</span>
        {Object.entries(GROUP_LABEL).map(([g, label]) => {
          const gNum = Number(g);
          const active = activeGroups.has(gNum);
          return (
            <button
              key={g}
              onClick={() => toggleGroup(gNum)}
              className={`flex items-center gap-1.5 rounded-[6px] border px-2 py-1 font-mono text-[10px] transition-opacity ${
                active ? 'border-border opacity-100' : 'border-border/40 opacity-40'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: GROUP_COLOR[gNum] }}
              />
              {label}
            </button>
          );
        })}
        <span className="text-muted-fg ml-auto font-mono text-[10px]">
          {nodes.length} nodes · {edgeList.length} edges
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-[720px] w-full"
        onMouseLeave={() => setHovered(null)}
      >
        {edgeList.map((e, i) => {
          const s = nodes[e.a];
          const t = nodes[e.b];
          if (!s || !t) return null;
          if (!activeGroups.has(s.group) || !activeGroups.has(t.group)) return null;
          const faded =
            highlightSet && !(highlightSet.has(s.id) && highlightSet.has(t.id)) ? 0.08 : 1;
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={EDGE_COLOR[e.kind] ?? 'rgba(148,163,184,0.2)'}
              strokeWidth={e.kind === 'shares_stack' ? 1.5 : 1}
              style={{ opacity: faded }}
            />
          );
        })}
        {nodes.map((n) => {
          if (!activeGroups.has(n.group)) return null;
          const r = Math.max(5, Math.min(14, 5 + Math.sqrt(n.degree) * 2));
          const isH = hovered === n.id;
          const faded = highlightSet && !highlightSet.has(n.id) ? 0.15 : 1;
          const canClick = n.group === 1 && n.id.startsWith('brand:');
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              style={{ cursor: canClick ? 'pointer' : 'default', opacity: faded }}
              onMouseEnter={() => setHovered(n.id)}
              onClick={() => handleNodeClick(n)}
            >
              <circle
                r={r}
                fill={GROUP_COLOR[n.group] ?? GROUP_COLOR[5]}
                stroke={isH ? '#fff' : 'rgba(0,0,0,0.4)'}
                strokeWidth={isH ? 2 : 1}
              />
              {(isH || n.group === 1) && (
                <text
                  x={r + 4}
                  y={3}
                  fontSize={10}
                  fontFamily="ui-monospace,monospace"
                  fill="#e2e8f0"
                  style={{ pointerEvents: 'none' }}
                >
                  {n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className="border-border bg-surface-elevated absolute mt-2 max-w-sm rounded-[6px] border p-3 text-xs">
          {(() => {
            const n = nodeById(hovered);
            if (!n) return null;
            return (
              <>
                <p className="text-fg font-medium">{n.label}</p>
                <p className="text-muted-fg mt-0.5 font-mono text-[10px]">
                  {GROUP_LABEL[n.group]} · degree {n.degree}
                </p>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
