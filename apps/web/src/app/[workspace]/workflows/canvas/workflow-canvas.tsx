'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NodeStatus = 'idle' | 'active' | 'done' | 'error';

interface NodeSpec {
  id: string;
  label: string;
  role: string;
  model?: string;
  description: string;
  x: number; // grid col
  y: number; // grid row
  defaults: Record<string, string | number | boolean>;
}

interface Edge {
  from: string;
  to: string;
  /** Optional branch label — e.g. "on success" */
  label?: string;
}

const GRAPH: { nodes: NodeSpec[]; edges: Edge[] } = {
  nodes: [
    {
      id: 'conductor',
      label: 'Conductor',
      role: 'Intent router',
      model: 'claude-haiku-4.5',
      description:
        'Classifies the incoming brand URL, picks the right sub-graph, and primes workspace context.',
      x: 0,
      y: 1,
      defaults: { intent_tags: 'all', budget_usd: 0.05 },
    },
    {
      id: 'scraper',
      label: 'Scraper',
      role: 'Playwright + proxy',
      description:
        'Renders the brand site, extracts meta/tech/screenshots via Mullvad-routed fetches.',
      x: 1,
      y: 0,
      defaults: { max_pages: 8, proxy_pool: 'mullvad.rotate' },
    },
    {
      id: 'enrich',
      label: 'Enrich',
      role: 'Brand DNA inference',
      model: 'gemini-2.5-pro',
      description: 'LLM synthesizes tone, audience, positioning from scraped HTML into DNA vector.',
      x: 2,
      y: 1,
      defaults: { cache_control: 'ephemeral', max_tokens: 1200 },
    },
    {
      id: 'discovery',
      label: 'Discovery',
      role: 'Competitor fan-out',
      model: 'gemini-2.5-flash',
      description:
        'Finds 3-5 DNA twins + direct competitors. Enqueues each into its own research run.',
      x: 1,
      y: 2,
      defaults: { top_k: 5, similarity_threshold: 0.72 },
    },
    {
      id: 'evaluator',
      label: 'Evaluator',
      role: 'Quality gate',
      model: 'claude-sonnet-4.6',
      description:
        'Scores the synthesis on 4 dimensions. If < 70, loops back to enrich with feedback.',
      x: 3,
      y: 0,
      defaults: { min_score: 0.7, max_retries: 2 },
    },
    {
      id: 'supervisor',
      label: 'Supervisor',
      role: 'Policy guardrail',
      description: 'Non-LLM state machine. Enforces budget, loop prevention, and workspace quotas.',
      x: 3,
      y: 2,
      defaults: { max_iterations: 5, max_runtime_sec: 90 },
    },
    {
      id: 'format',
      label: 'Output',
      role: 'Briefing + persist',
      description: 'Renders PDF briefing + upserts brand row + fires workspace notifications.',
      x: 4,
      y: 1,
      defaults: { output: 'briefing.pdf', notify: 'slack+inbox' },
    },
  ],
  edges: [
    { from: 'conductor', to: 'scraper' },
    { from: 'conductor', to: 'discovery' },
    { from: 'scraper', to: 'enrich' },
    { from: 'enrich', to: 'evaluator' },
    { from: 'evaluator', to: 'supervisor', label: 'score' },
    { from: 'discovery', to: 'supervisor' },
    { from: 'supervisor', to: 'format', label: 'pass' },
    { from: 'evaluator', to: 'enrich', label: 'retry' },
  ],
};

// Grid → pixel layout
const COL_WIDTH = 220;
const ROW_HEIGHT = 150;
const NODE_W = 180;
const NODE_H = 96;
const PAD_X = 40;
const PAD_Y = 40;

function nodeCenter(n: NodeSpec): { cx: number; cy: number } {
  const cx = PAD_X + n.x * COL_WIDTH + NODE_W / 2;
  const cy = PAD_Y + n.y * ROW_HEIGHT + NODE_H / 2;
  return { cx, cy };
}

function bezierPath(a: NodeSpec, b: NodeSpec): string {
  const A = nodeCenter(a);
  const B = nodeCenter(b);
  const dx = (B.cx - A.cx) * 0.5;
  return `M ${A.cx} ${A.cy} C ${A.cx + dx} ${A.cy}, ${B.cx - dx} ${B.cy}, ${B.cx} ${B.cy}`;
}

export function WorkflowCanvas({ workspaceSlug: _slug }: { workspaceSlug: string }) {
  const [selected, setSelected] = useState<string>('conductor');
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const canvasWidth = PAD_X * 2 + 5 * COL_WIDTH - (COL_WIDTH - NODE_W);
  const canvasHeight = PAD_Y * 2 + 3 * ROW_HEIGHT - (ROW_HEIGHT - NODE_H);

  const selectedNode = useMemo(
    () => GRAPH.nodes.find((n) => n.id === selected) ?? GRAPH.nodes[0],
    [selected],
  );
  if (!selectedNode) throw new Error('Workflow graph has no nodes');

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setStatuses({});
    setLogs([]);

    // Client-side simulated pipeline. A real implementation would POST to
    // /api/[workspace]/workflows/run and consume the Aquila SSE stream.
    const order = [
      'conductor',
      'scraper',
      'discovery',
      'enrich',
      'evaluator',
      'supervisor',
      'format',
    ];
    for (const id of order) {
      setStatuses((prev) => ({ ...prev, [id]: 'active' }));
      setLogs((prev) => [...prev, `[${time()}] ${id} · started`]);
      await sleep(700 + Math.random() * 900);
      const failRetry = id === 'evaluator' && Math.random() < 0.4;
      if (failRetry) {
        setStatuses((prev) => ({ ...prev, [id]: 'error' }));
        setLogs((prev) => [...prev, `[${time()}] ${id} · score below threshold, looping back`]);
        await sleep(500);
        setStatuses((prev) => ({ ...prev, enrich: 'active' }));
        setLogs((prev) => [...prev, `[${time()}] enrich · retry with feedback`]);
        await sleep(700);
        setStatuses((prev) => ({ ...prev, enrich: 'done' }));
        setStatuses((prev) => ({ ...prev, [id]: 'active' }));
        await sleep(600);
      }
      setStatuses((prev) => ({ ...prev, [id]: 'done' }));
      setLogs((prev) => [...prev, `[${time()}] ${id} · done`]);
    }
    setLogs((prev) => [...prev, `[${time()}] ✓ pipeline complete · briefing.pdf ready`]);
    setRunning(false);
  }, [running]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* ── Canvas ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[.75rem] border border-[#1b1b1b] bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#0c0605]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_300px_at_50%_0%,rgba(203,53,0,0.12),transparent_70%)]"
        />

        {/* toolbar */}
        <div className="relative flex items-center justify-between border-b border-[#1b1b1b] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
              workflow
            </span>
            <span className="text-[13px] font-semibold text-[#ffffff]">brand intelligence v1</span>
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${
                running
                  ? 'border-[#cb3500]/40 bg-[#cb3500]/10 text-[#f0b89a]'
                  : 'border-[#1b1b1b] bg-[#0a0a0a] text-[#4a5464]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-[#cb3500]' : 'bg-[#535353]'}`}
                aria-hidden
              />
              {running ? 'executing' : 'ready'}
            </span>
          </div>
          <button
            onClick={run}
            disabled={running}
            className="group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-[.35rem] bg-[#cb3500] px-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#ffffff] shadow-[0_0_20px_rgba(203,53,0,0.3)] transition-all hover:bg-[#ed6d40] hover:shadow-[0_0_30px_rgba(203,53,0,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              aria-hidden
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            <TriangleGlyph />
            {running ? 'running' : 'run pipeline'}
          </button>
        </div>

        {/* SVG canvas */}
        <div className="relative overflow-auto">
          <svg
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            className="block h-auto w-full min-w-[1100px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="grid-dots"
                x="0"
                y="0"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="0.7" fill="#1b1b1b" />
              </pattern>
              <filter id="node-glow">
                <feGaussianBlur stdDeviation="3" />
              </filter>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#535353" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#cb3500" />
              </marker>
            </defs>

            <rect width={canvasWidth} height={canvasHeight} fill="url(#grid-dots)" />

            {/* edges */}
            {GRAPH.edges.map((e, i) => {
              const a = GRAPH.nodes.find((n) => n.id === e.from);
              const b = GRAPH.nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const active =
                statuses[e.from] === 'done' &&
                (statuses[e.to] === 'active' || statuses[e.to] === 'done');
              return (
                <g key={i}>
                  <path
                    d={bezierPath(a, b)}
                    fill="none"
                    stroke={active ? '#cb3500' : '#23282f'}
                    strokeWidth={active ? 2 : 1.2}
                    markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'}
                    style={{ filter: active ? 'drop-shadow(0 0 4px #cb3500)' : undefined }}
                  />
                  {active && (
                    <circle r="3" fill="#cb3500">
                      <animateMotion dur="1.2s" repeatCount="indefinite" path={bezierPath(a, b)} />
                    </circle>
                  )}
                  {e.label && (
                    <text
                      x={(nodeCenter(a).cx + nodeCenter(b).cx) / 2}
                      y={(nodeCenter(a).cy + nodeCenter(b).cy) / 2 - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="monospace"
                      fill="#4a5464"
                      style={{ textTransform: 'uppercase', letterSpacing: '0.18em' }}
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* nodes */}
            {GRAPH.nodes.map((n) => {
              const status = statuses[n.id] ?? 'idle';
              const isSelected = n.id === selected;
              const center = nodeCenter(n);
              const x = center.cx - NODE_W / 2;
              const y = center.cy - NODE_H / 2;
              const { stroke, fill } = stylesForStatus(status, isSelected);
              return (
                <g
                  key={n.id}
                  transform={`translate(${x},${y})`}
                  onClick={() => setSelected(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {status === 'active' && (
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx="8"
                      fill={fill}
                      stroke={stroke}
                      strokeWidth="1.2"
                      style={{ filter: 'drop-shadow(0 0 12px rgba(203,53,0,0.55))' }}
                    />
                  )}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="8"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2 : 1.2}
                  />
                  {/* status dot */}
                  <circle
                    cx={NODE_W - 14}
                    cy={14}
                    r="4"
                    fill={statusDotColor(status)}
                    style={{ filter: `drop-shadow(0 0 4px ${statusDotColor(status)})` }}
                  />
                  <text
                    x="16"
                    y="24"
                    fontSize="9"
                    fontFamily="monospace"
                    fill="#4a5464"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.22em' }}
                  >
                    {n.role}
                  </text>
                  <text x="16" y="48" fontSize="17" fontWeight="700" fill="#ffffff">
                    {n.label}
                  </text>
                  {n.model && (
                    <text x="16" y="72" fontSize="10" fontFamily="monospace" fill="#888888">
                      {n.model}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* log strip */}
        <div className="relative border-t border-[#1b1b1b] bg-[#050505] px-5 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
              execution log
            </span>
            <span className="font-mono text-[10px] text-[#4a5464]">
              {logs.length} event{logs.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="max-h-[120px] overflow-y-auto font-mono text-[11px] leading-relaxed text-[#888888]">
            {logs.length === 0 && (
              <p className="italic text-[#4a5464]">idle — press run to start</p>
            )}
            {logs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* ── Inspector ───────────────────────────────────────────────── */}
      <aside className="rounded-[.75rem] border border-[#1b1b1b] bg-[#0a0a0a] p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
          inspector · {selectedNode.id}
        </p>
        <h3 className="mt-2 text-[22px] font-bold tracking-tight text-[#ffffff]">
          {selectedNode.label}
        </h3>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#cb3500]">
          {selectedNode.role}
        </p>
        {selectedNode.model && (
          <p className="mt-3 flex items-center gap-2 rounded-[.35rem] border border-[#1b1b1b] bg-[#050505] px-3 py-2 font-mono text-[11px] text-[#dadada]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#59a993]" aria-hidden />
            {selectedNode.model}
          </p>
        )}
        <p className="mt-4 text-[13px] leading-relaxed text-[#888888]">
          {selectedNode.description}
        </p>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4a5464]">
            defaults
          </p>
          <dl className="mt-3 space-y-2">
            {Object.entries(selectedNode.defaults).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 border-b border-[#1b1b1b] py-2 last:border-0"
              >
                <dt className="font-mono text-[11px] text-[#888888]">{k}</dt>
                <dd className="font-mono text-[11px] text-[#ffffff]">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-[.35rem] border border-[#1b1b1b] bg-[#050505] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#dadada] transition-colors hover:border-[#cb3500] hover:text-[#ffffff]"
          >
            edit config
          </button>
          <button
            type="button"
            className="rounded-[.35rem] border border-[#1b1b1b] bg-[#050505] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#dadada] transition-colors hover:border-[#cb3500] hover:text-[#ffffff]"
          >
            logs
          </button>
        </div>
      </aside>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

function stylesForStatus(status: NodeStatus, selected: boolean): { stroke: string; fill: string } {
  if (status === 'active') return { stroke: '#cb3500', fill: '#1a0805' };
  if (status === 'done') return { stroke: '#59a993', fill: '#081a14' };
  if (status === 'error') return { stroke: '#ed6d40', fill: '#1a0a05' };
  if (selected) return { stroke: '#535353', fill: '#111111' };
  return { stroke: '#1b1b1b', fill: '#0a0a0a' };
}

function statusDotColor(status: NodeStatus): string {
  if (status === 'active') return '#cb3500';
  if (status === 'done') return '#59a993';
  if (status === 'error') return '#ed6d40';
  return '#23282f';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function time() {
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0').slice(0, 2)}`;
}

function TriangleGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M 2 1 L 9 5 L 2 9 z" />
    </svg>
  );
}
