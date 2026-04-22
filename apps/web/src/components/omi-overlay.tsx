'use client';

import { Brain, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  analyzeFromCommandAction,
  compareFromCommandAction,
  investigateFromCommandAction,
  newsFromCommandAction,
  twinsFromCommandAction,
  type ToolResult,
} from '@/actions/omi-tools';
import { INTENT_LABELS, parseOmiCommand, type OmiIntent } from '@/lib/omi-commands';

type Role = 'user' | 'assistant';

interface ToolAttachment {
  intent: OmiIntent;
  link?: string | undefined;
  summary: string;
  detail?: string | undefined;
}

interface Message {
  role: Role;
  content: string;
  tool?: ToolAttachment;
}

interface Props {
  workspace: string;
}

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Analizá la última marca', prompt: 'analizá nike' },
  { label: 'Comparar dos', prompt: 'compará chanel vs dior' },
  { label: 'Novedades hoy', prompt: 'novedades' },
  { label: 'Resumí esta pantalla', prompt: 'Hacé un resumen de lo que estoy viendo.' },
];

/**
 * OMI — floating command-palette chat. Global hotkeys:
 *  - ⌘/Ctrl + K toggles
 *  - Double-tap Space toggles
 *  - Esc closes
 * Sends route context (pathname, detected brand_id) along with each message
 * so Aquila grounds answers to what the user is looking at.
 */
export function OmiOverlay({ workspace }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  // Hotkeys: ⌘/Ctrl+K + double-Space + Esc.
  useEffect(() => {
    let lastSpace = 0;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typingInField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === ' ' && !typingInField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const now = Date.now();
        if (now - lastSpace < 320) {
          e.preventDefault();
          toggle();
          lastSpace = 0;
        } else {
          lastSpace = now;
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle, close, open]);

  // Focus input + autoscroll on open / new message.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const priorHistory = messages;
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    // Intent parsing first — if the user said "analizá X", skip the LLM and
    // run the tool. Fallback to chat only when the regex doesn't match.
    const parsed = parseOmiCommand(trimmed);
    if (parsed) {
      try {
        const msg = await runTool(parsed.intent, parsed.args, workspace);
        setMessages((m) => [...m, msg]);
        return;
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'error';
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: `No pude ejecutar el comando: ${detail}.`,
          },
        ]);
        return;
      } finally {
        setLoading(false);
      }
    }

    try {
      const res = await fetch(`/api/${workspace}/omi/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: priorHistory,
          context: contextFromPath(pathname, workspace),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { answer: string };
      setMessages((m) => [...m, { role: 'assistant', content: data.answer || '(sin respuesta)' }]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'error';
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `No pude responder: ${detail}. Probá de nuevo en unos segundos.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  if (!open) return null;

  const ctxLabel = routeLabel(pathname, workspace);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="border-border bg-surface flex max-h-[75vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[12px] border shadow-2xl">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="text-accent h-4 w-4" />
            <div>
              <div className="text-fg text-sm font-semibold">Forgentic</div>
              <div className="text-muted-fg font-mono text-[10px]">
                {ctxLabel ? `contexto: ${ctxLabel}` : 'asistente global'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="text-muted-fg hover:text-fg rounded-[4px] p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !loading && (
            <div className="space-y-3 py-2">
              <p className="text-muted-fg text-xs">
                Preguntá lo que necesites. Conozco el contexto de esta pantalla.
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    type="button"
                    onClick={() => void send(qa.prompt)}
                    disabled={loading}
                    className="border-border bg-surface-elevated text-fg hover:border-accent/40 rounded-[6px] border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  m.role === 'user'
                    ? 'bg-accent/10 text-fg border-accent/30 max-w-[85%] rounded-[8px] border px-3 py-2 text-sm'
                    : 'border-border bg-surface-elevated text-fg max-w-[85%] whitespace-pre-wrap rounded-[8px] border px-3 py-2 text-sm leading-relaxed'
                }
              >
                {m.tool && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] ${intentBadgeClass(m.tool.intent)}`}
                    >
                      {m.tool.summary}
                    </span>
                    {m.tool.link && (
                      <a
                        href={m.tool.link}
                        className="text-accent font-mono text-[10px] hover:underline"
                      >
                        abrir ↗
                      </a>
                    )}
                  </div>
                )}
                {m.content}
                {m.tool?.detail && (
                  <div className="text-muted-fg mt-2 border-t border-[#3a4452] pt-2 font-mono text-[10px]">
                    {m.tool.detail}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="border-border bg-surface-elevated text-muted-fg rounded-[8px] border px-3 py-2 font-mono text-xs">
                pensando…
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-border border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escribí y Enter para enviar · Esc cierra"
              rows={2}
              className="border-border bg-surface-elevated text-fg flex-1 resize-none rounded-[6px] border px-3 py-2 text-sm focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-accent hover:bg-accent/90 text-accent-fg rounded-[6px] px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
          <div className="text-muted-fg mt-2 flex items-center justify-between font-mono text-[10px]">
            <span>⌘K o doble-Space abre · Shift+Enter = salto de línea</span>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="hover:text-fg underline-offset-2 transition-colors hover:underline"
              >
                limpiar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function routeLabel(pathname: string, workspace: string): string {
  const base = `/${workspace}`;
  if (!pathname.startsWith(base)) return '';
  const rest = pathname.slice(base.length).replace(/^\/+/, '');
  if (!rest) return 'resumen del workspace';
  // Derive a friendly label from the leading segment.
  const seg = rest.split('/')[0] ?? '';
  const map: Record<string, string> = {
    brands: 'marcas',
    cerebro: 'cerebro',
    chat: 'chat',
    insights: 'insights',
    pulse: 'market pulse',
    alerts: 'alertas',
    discovery: 'descubrimiento',
    research: 'research',
    battlecards: 'battlecards',
    heatmap: 'heatmap',
    export: 'export',
    schedules: 'schedules',
    activity: 'actividad',
    generate: 'generate',
    clash: 'clash',
    glossary: 'glossary',
    settings: 'settings',
    billing: 'billing',
    pins: 'pins',
  };
  const label = map[seg] ?? seg;
  const tail = rest.slice(seg.length).replace(/^\/+/, '');
  return tail ? `${label} · ${tail}` : label;
}

function intentBadgeClass(intent: OmiIntent): string {
  switch (intent) {
    case 'analyze':
      return 'border-accent/40 bg-accent/10 text-accent';
    case 'compare':
      return 'border-purple-500/30 bg-purple-500/10 text-purple-400';
    case 'investigate':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
    case 'twins':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'news':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
  }
}

async function runTool(
  intent: OmiIntent,
  args: Record<string, string>,
  workspace: string,
): Promise<Message> {
  const label = INTENT_LABELS[intent];
  let result: ToolResult;
  switch (intent) {
    case 'analyze': {
      result = await analyzeFromCommandAction({
        workspaceSlug: workspace,
        rawTarget: args['target'] ?? '',
      });
      return result.ok
        ? assistantTool(
            label,
            intent,
            result.link,
            `Brief generado para "${args['target']}". Confianza ${confidenceOf(result)}.`,
            briefSummary(result),
          )
        : assistantError(label, result.error);
    }
    case 'compare': {
      result = await compareFromCommandAction({
        workspaceSlug: workspace,
        rawA: args['a'] ?? '',
        rawB: args['b'] ?? '',
      });
      return result.ok
        ? assistantTool(
            label,
            intent,
            result.link,
            `Clash: ${args['a']} vs ${args['b']}.`,
            compareSummary(result),
          )
        : assistantError(label, result.error);
    }
    case 'investigate': {
      result = await investigateFromCommandAction({
        workspaceSlug: workspace,
        rawTarget: args['target'] ?? '',
      });
      return result.ok
        ? assistantTool(
            label,
            intent,
            result.link,
            `Research disparado para "${args['target']}". Seguí el progreso en el link.`,
          )
        : assistantError(label, result.error);
    }
    case 'twins': {
      result = await twinsFromCommandAction({
        workspaceSlug: workspace,
        rawTarget: args['target'] ?? '',
      });
      return result.ok
        ? assistantTool(
            label,
            intent,
            result.link,
            `DNA twins de "${args['target']}".`,
            twinsSummary(result),
          )
        : assistantError(label, result.error);
    }
    case 'news': {
      result = await newsFromCommandAction({
        workspaceSlug: workspace,
        rawTarget: args['target'],
      });
      return result.ok
        ? assistantTool(
            label,
            intent,
            result.link,
            args['target']
              ? `Novedades de "${args['target']}".`
              : 'Novedades recientes del portfolio.',
            newsSummary(result),
          )
        : assistantError(label, result.error);
    }
  }
}

function assistantTool(
  label: string,
  intent: OmiIntent,
  link: string | undefined,
  summary: string,
  detail?: string,
): Message {
  return {
    role: 'assistant',
    content: summary,
    tool: { intent, link, summary: label, detail },
  };
}

function assistantError(label: string, err?: string): Message {
  return {
    role: 'assistant',
    content: `${label}: ${err ?? 'sin detalles'}`,
  };
}

function confidenceOf(r: ToolResult): string {
  const data = r.data as { brief?: { confidence?: number } } | undefined;
  const c = data?.brief?.confidence;
  return typeof c === 'number' ? `${Math.round(c * 100)}%` : '—';
}

function briefSummary(r: ToolResult): string {
  const data = r.data as { brief?: { situation_summary?: string } } | undefined;
  return data?.brief?.situation_summary ?? '';
}

function compareSummary(r: ToolResult): string {
  const data = r.data as { verdict?: string; summary?: string; winner?: string } | undefined;
  if (!data) return '';
  return data.verdict ?? data.summary ?? (data.winner ? `Ganador: ${data.winner}` : '');
}

function twinsSummary(r: ToolResult): string {
  const data = r.data as
    | {
        items?: { brand_id: string; name?: string; similarity?: number }[];
        twins?: { brand_id: string; name?: string; similarity?: number }[];
      }
    | undefined;
  const arr = data?.items ?? data?.twins ?? [];
  if (arr.length === 0) return 'Sin twins encontrados.';
  return arr
    .slice(0, 5)
    .map(
      (t) =>
        `${t.name ?? t.brand_id}${t.similarity != null ? ` (${Math.round(t.similarity * 100)}%)` : ''}`,
    )
    .join(' · ');
}

function newsSummary(r: ToolResult): string {
  const data = r.data as { items?: unknown[] } | undefined;
  const count = data?.items?.length ?? 0;
  return count > 0 ? `${count} cambios recientes.` : 'Sin novedades recientes.';
}

function contextFromPath(pathname: string, workspace: string) {
  const base = `/${workspace}`;
  const rest = pathname.startsWith(base)
    ? pathname.slice(base.length).replace(/^\/+/, '')
    : pathname;
  const segs = rest.split('/').filter(Boolean);
  // Heuristic: if first seg is "brands" and next is a non-sub-route, treat as brand_id.
  const brandId =
    segs[0] === 'brands' && segs[1] && !['new', 'create'].includes(segs[1]) ? segs[1] : null;
  return {
    pathname,
    brand_id: brandId,
    route_hint: rest || 'resumen del workspace',
  };
}
