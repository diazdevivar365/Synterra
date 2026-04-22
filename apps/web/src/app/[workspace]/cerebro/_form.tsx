'use client';

import { useState, useTransition } from 'react';

import { analyzeBrandAction, type AnalyzeResult } from '@/actions/cerebro';

import type { StrategyBrief } from '@/lib/cerebro';

interface BrandOption {
  id: string;
  name: string;
}

interface Props {
  workspace: string;
  brands: BrandOption[];
  defaultBrandId?: string | undefined;
}

const INTENTS = [
  { value: 'audit', label: 'Auditoría' },
  { value: 'pivot', label: 'Pivote' },
  { value: 'launch', label: 'Lanzamiento' },
  { value: 'crisis', label: 'Crisis' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'positioning', label: 'Posicionamiento' },
];

const IMPACT_STYLES: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const HORIZON_LABEL: Record<string, string> = {
  now: 'Ahora',
  '7d': '7 días',
  '30d': '30 días',
  quarter: 'Trimestre',
};

export function CerebroForm({ workspace, brands, defaultBrandId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  function onSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await analyzeBrandAction(formData);
      setResult(res);
    });
  }

  return (
    <div className="space-y-8">
      <form
        action={onSubmit}
        className="border-border bg-surface space-y-4 rounded-[8px] border p-6"
      >
        <input type="hidden" name="workspace" value={workspace} />

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-1.5">
            <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Marca
            </label>
            <select
              name="brand_id"
              required
              defaultValue={defaultBrandId ?? brands[0]?.id ?? ''}
              className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Intent
            </label>
            <select
              name="intent"
              defaultValue="audit"
              className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
            >
              {INTENTS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
            Pregunta
          </label>
          <textarea
            name="query"
            required
            minLength={3}
            rows={3}
            placeholder="Ejemplo: ¿Dónde estamos perdiendo share frente a la competencia premium este trimestre?"
            className="border-border bg-surface-elevated text-fg w-full rounded-[6px] border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-muted-fg font-mono text-[10px]">
            Cerebro ingesta señales reales de Aquila (intel + battlecards + pulse + alertas +
            snapshots).
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="bg-accent hover:bg-accent/90 text-accent-fg rounded-[6px] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isPending ? 'Analizando…' : 'Analizar'}
          </button>
        </div>
      </form>

      {isPending && (
        <div className="border-border bg-surface flex min-h-[200px] items-center justify-center rounded-[8px] border">
          <div className="text-center">
            <p className="text-fg text-sm font-medium">Cerebro trabajando…</p>
            <p className="text-muted-fg mt-1 font-mono text-[10px]">
              Recolectando señales · consultando memoria · sintetizando (10-30s)
            </p>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-[8px] border border-red-500/30 bg-red-500/5 p-4">
          <p className="font-mono text-xs text-red-400">Error: {result.error}</p>
        </div>
      )}

      {result?.ok && result.brief && <BriefCard brief={result.brief} />}
    </div>
  );
}

export function BriefCard({ brief }: { brief: StrategyBrief }) {
  const confidencePct = Math.round(brief.confidence * 100);
  const confidenceColor =
    confidencePct >= 70
      ? 'text-emerald-400'
      : confidencePct >= 40
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="space-y-6">
      <div className="border-border bg-surface rounded-[8px] border p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-muted-fg font-mono text-[10px] uppercase tracking-wider">
              Resumen
            </div>
            <div className="text-muted-fg mt-0.5 font-mono text-[10px]">
              {brief.brand_id} · {brief.intent}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-mono text-xl font-bold ${confidenceColor}`}>{confidencePct}%</div>
            <div className="text-muted-fg font-mono text-[9px] uppercase tracking-wider">
              confianza
            </div>
          </div>
        </div>
        <p className="text-fg text-base leading-relaxed">{brief.situation_summary}</p>

        <div className="border-border mt-4 border-t pt-4">
          <div className="text-muted-fg mb-1.5 font-mono text-[10px] uppercase tracking-wider">
            Posicionamiento competitivo
          </div>
          <p className="text-fg text-sm leading-relaxed">{brief.competitive_stance}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BriefBulletCard title="Insights" items={brief.key_insights} tone="accent" />
        <BriefBulletCard title="Oportunidades" items={brief.opportunities} tone="emerald" />
        <BriefBulletCard title="Tensiones" items={brief.tensions} tone="amber" />
        <BriefBulletCard title="Riesgos" items={brief.risks} tone="red" />
      </div>

      <div className="border-border bg-surface rounded-[8px] border p-6">
        <h3 className="text-fg mb-4 text-base font-semibold">Recomendaciones</h3>
        <ol className="space-y-4">
          {brief.recommendations.map((rec, idx) => (
            <li key={idx} className="border-border bg-surface-elevated rounded-[6px] border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-muted-fg font-mono text-[10px]">#{idx + 1}</span>
                <span
                  className={`rounded-[4px] border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${IMPACT_STYLES[rec.impact] ?? ''}`}
                >
                  {rec.impact}
                </span>
                <span className="border-border text-muted-fg rounded-[4px] border px-2 py-0.5 font-mono text-[9px]">
                  {HORIZON_LABEL[rec.horizon] ?? rec.horizon}
                </span>
              </div>
              <p className="text-fg text-sm font-medium">{rec.action}</p>
              <p className="text-muted-fg mt-1.5 text-xs leading-relaxed">{rec.rationale}</p>
              {rec.references.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rec.references.map((r, i) => (
                    <span
                      key={i}
                      className="bg-surface text-muted-fg rounded px-1.5 py-0.5 font-mono text-[9px]"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      {brief.references.length > 0 && (
        <div className="border-border bg-surface rounded-[8px] border p-4">
          <div className="text-muted-fg mb-2 font-mono text-[10px] uppercase tracking-wider">
            Fuentes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {brief.references.map((r, i) => (
              <span
                key={i}
                className="border-border bg-surface-elevated text-fg rounded-[4px] border px-2 py-0.5 font-mono text-[10px]"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TONE_STYLES: Record<string, string> = {
  accent: 'border-accent/30',
  emerald: 'border-emerald-500/30',
  amber: 'border-amber-500/30',
  red: 'border-red-500/30',
};

function BriefBulletCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className={`bg-surface rounded-[8px] border p-5 ${TONE_STYLES[tone] ?? 'border-border'}`}>
      <h3 className="text-fg mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-fg flex gap-2 text-xs leading-relaxed">
            <span className="text-muted-fg mt-0.5 font-mono">›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
