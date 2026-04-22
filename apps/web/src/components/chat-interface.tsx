'use client';

import { Send } from 'lucide-react';
import { useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Props {
  slug: string;
  brands: Brand[];
}

export function ChatInterface({ slug, brands }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [brandId, setBrandId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/${slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          brand_id: brandId || null,
          history: messages,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { answer: string };
      setMessages([...nextMessages, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand focus selector */}
      <div className="border-border flex items-center gap-3 border-b px-4 py-2">
        <span className="text-muted-fg text-xs">Focus brand:</span>
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="bg-surface border-border text-fg min-w-[160px] rounded border px-2 py-1 text-xs"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            className="text-muted-fg hover:text-fg ml-auto text-xs"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-muted-fg py-16 text-center text-sm">
            Ask anything about your brands — positioning, gaps, competitor moves, trends.
          </div>
        )}
        {messages.map((m, i) => (
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
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-elevated border-border text-muted-fg rounded-lg border px-4 py-2.5 text-sm">
              Analyzing…
            </div>
          </div>
        )}
        {error && <div className="text-danger text-center text-xs">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={submit} className="border-border flex gap-2 border-t p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about brand strategy, competitors, positioning…"
          className="bg-surface border-border text-fg placeholder:text-muted-fg focus:ring-accent flex-1 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-accent hover:bg-accent/90 rounded px-3 py-2 text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
