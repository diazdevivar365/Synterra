'use client';

import { MessageSquarePlus, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: string;
  title: string;
  brandId: string;
  messages: Message[];
  updatedAt: number;
}

interface Brand {
  id: string;
  name: string;
}

interface Props {
  slug: string;
  brands: Brand[];
}

const STORAGE_KEY = 'forgentic.chat.sessions';
const ACTIVE_KEY = 'forgentic.chat.active';

function loadSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Session[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    /* quota/full — ignore */
  }
}

function newSession(brandId: string): Session {
  return {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'New chat',
    brandId,
    messages: [],
    updatedAt: Date.now(),
  };
}

export function ChatInterface({ slug, brands }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loaded = loadSessions();
    if (loaded.length === 0) {
      const s = newSession('');
      setSessions([s]);
      setActiveId(s.id);
      saveSessions([s]);
      return;
    }
    setSessions(loaded);
    const storedActive = window.localStorage.getItem(ACTIVE_KEY);
    const pick = loaded.find((s) => s.id === storedActive) ?? loaded[0];
    if (pick) setActiveId(pick.id);
  }, []);

  useEffect(() => {
    if (activeId) window.localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  const active = sessions.find((s) => s.id === activeId);

  function updateActive(mutator: (s: Session) => Session): void {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === activeId ? mutator(s) : s));
      saveSessions(next);
      return next;
    });
  }

  function startNew() {
    const s = newSession(active?.brandId ?? '');
    setSessions((prev) => {
      const next = [s, ...prev];
      saveSessions(next);
      return next;
    });
    setActiveId(s.id);
    setStreaming('');
    setError(null);
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const s = newSession('');
        setActiveId(s.id);
        saveSessions([s]);
        return [s];
      }
      if (id === activeId && next[0]) setActiveId(next[0].id);
      saveSessions(next);
      return next;
    });
  }

  function setBrand(brandId: string) {
    updateActive((s) => ({ ...s, brandId, updatedAt: Date.now() }));
  }

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading || !active) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = active.messages;
    const titleUpdate = active.messages.length === 0 ? text.slice(0, 60) : active.title;

    updateActive((s) => ({
      ...s,
      messages: [...s.messages, userMsg],
      title: titleUpdate,
      updatedAt: Date.now(),
    }));
    setInput('');
    setIsLoading(true);
    setStreaming('');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/${slug}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          brand_id: active.brandId || null,
          history,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = event.split('\n');
          let eventName = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (eventName === 'delta' && data) {
            try {
              const parsed = JSON.parse(data) as { text?: string };
              if (parsed.text) {
                accumulated += parsed.text;
                setStreaming(accumulated);
              }
            } catch {
              /* skip bad chunk */
            }
          } else if (eventName === 'error') {
            try {
              const parsed = JSON.parse(data) as { error?: string };
              throw new Error(parsed.error ?? 'stream error');
            } catch (e) {
              throw e instanceof Error ? e : new Error('stream error');
            }
          }
        }
      }

      const assistantMsg: Message = { role: 'assistant', content: accumulated };
      updateActive((s) => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        updatedAt: Date.now(),
      }));
      setStreaming('');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        /* user aborted */
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function abort() {
    abortRef.current?.abort();
    setIsLoading(false);
    setStreaming('');
  }

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-full">
      <aside className="border-border w-56 shrink-0 overflow-y-auto border-r">
        <div className="border-border sticky top-0 border-b p-2">
          <button
            onClick={startNew}
            className="bg-accent/10 text-accent hover:bg-accent/20 flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>
        <ul className="space-y-0.5 p-2">
          {sortedSessions.map((s) => (
            <li
              key={s.id}
              className={`group flex items-center gap-1 rounded px-2 py-1.5 text-xs ${
                s.id === activeId
                  ? 'bg-surface-elevated border-border border'
                  : 'hover:bg-surface-elevated cursor-pointer'
              }`}
              onClick={() => setActiveId(s.id)}
            >
              <span className="text-fg truncate">{s.title || 'Untitled'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                }}
                className="text-muted-fg hover:text-danger ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete session"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="border-border flex items-center gap-3 border-b px-4 py-2">
          <span className="text-muted-fg text-xs">Focus brand:</span>
          <select
            value={active?.brandId ?? ''}
            onChange={(e) => setBrand(e.target.value)}
            className="bg-surface border-border text-fg min-w-[160px] rounded border px-2 py-1 text-xs"
            disabled={!active}
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="text-muted-fg ml-auto font-mono text-[10px]">
            {active?.messages.length ?? 0} turns
          </span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {active?.messages.length === 0 && !streaming && (
            <div className="text-muted-fg py-16 text-center text-sm">
              Ask anything about your brands — positioning, gaps, competitor moves, trends.
            </div>
          )}
          {active?.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-accent text-white'
                    : 'bg-surface-elevated border-border text-fg border'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <div className="bg-surface-elevated border-border text-fg max-w-[80%] whitespace-pre-wrap rounded-lg border px-4 py-2.5 text-sm">
                {streaming}
                <span className="bg-accent ml-1 inline-block h-3 w-1.5 animate-pulse align-middle" />
              </div>
            </div>
          )}
          {isLoading && !streaming && (
            <div className="flex justify-start">
              <div className="bg-surface-elevated border-border text-muted-fg rounded-lg border px-4 py-2.5 text-sm">
                Analyzing…
              </div>
            </div>
          )}
          {error && <div className="text-danger text-center text-xs">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={submit} className="border-border flex gap-2 border-t p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about brand strategy, competitors, positioning…"
            className="bg-surface border-border text-fg placeholder:text-muted-fg focus:ring-accent flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={abort}
              className="bg-danger/20 text-danger hover:bg-danger/30 rounded px-3 py-2 text-xs font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-accent hover:bg-accent/90 rounded px-3 py-2 text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
