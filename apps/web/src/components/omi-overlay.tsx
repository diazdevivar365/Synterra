'use client';

import { Brain, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: string;
}

interface Props {
  workspace: string;
}

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: 'Resumí lo que veo', prompt: 'Hacé un resumen de lo que estoy viendo en esta página.' },
  { label: 'Riesgos hoy', prompt: '¿Qué riesgos o alertas deberían preocuparme hoy?' },
  { label: 'Próxima acción', prompt: '¿Cuál sería la próxima acción concreta en esta pantalla?' },
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
                {m.content}
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
