/**
 * OMI command parser — detects verbs in free text that map to Aquila actions.
 *
 * Ported from OmeletStudio/Backend/tools/services/omi_command_parser.py.
 * Case-insensitive regex. First pattern that matches wins — more specific
 * patterns go first so "investigá X vs Y" doesn't get swallowed by "compare".
 * Returns null when text is plain conversation; the caller falls back to the
 * standard /chat pipeline in that case.
 *
 * Client-safe: no server imports, no secrets. Parser runs in the overlay
 * before any network call so we can show "→ comando detectado" instantly.
 */

export type OmiIntent = 'analyze' | 'compare' | 'investigate' | 'twins' | 'news';

export interface OmiCommand {
  intent: OmiIntent;
  args: Record<string, string>;
}

// Each rule: regex applied to trimmed input, groups carry the args.
// Order matters — specific first.
const RULES: { rx: RegExp; intent: OmiIntent }[] = [
  // "compará X vs Y", "comparame X vs Y", "compare X versus Y"
  {
    rx: /^(?:comparame?|comparar|compare|compará|compara)\s+(?<a>.+?)\s+(?:vs|versus|v\/s|y|con|against|contra)\s+(?<b>.+)$/i,
    intent: 'compare',
  },
  // "analizá X", "analiza X", "analyze X", "brief de X", "brief X"
  {
    rx: /^(?:analizá|analiza|analizar|analizame|analyze|analyse|brief(?:\s+de)?)\s+(?<target>.+)$/i,
    intent: 'analyze',
  },
  // "investigá X", "investigar X", "research X", "scrapear X", "scrapeame X"
  {
    rx: /^(?:investigá|investigar|investigame|research|scrapear|scrapeá|scrapeame)\s+(?<target>.+)$/i,
    intent: 'investigate',
  },
  // "twins de X", "DNA twins X", "dna X", "similares a X"
  {
    rx: /^(?:twins|dna(?:\s+twins)?|similares?)\s+(?:de\s+|a\s+)?(?<target>.+)$/i,
    intent: 'twins',
  },
  // "novedades de X", "qué novedades", "news", "cambios en X"
  {
    rx: /^(?:novedades|qué\s+novedades|que\s+novedades|news|cambios(?:\s+en)?|updates?)(?:\s+(?:de\s+)?(?<target>.+))?$/i,
    intent: 'news',
  },
];

export function parseOmiCommand(text: string): OmiCommand | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const rule of RULES) {
    const m = rule.rx.exec(trimmed);
    if (!m) continue;
    const groups = m.groups ?? {};
    const args: Record<string, string> = {};
    for (const [k, v] of Object.entries(groups)) {
      if (typeof v === 'string' && v.trim()) {
        args[k] = v.trim();
      }
    }
    return { intent: rule.intent, args };
  }
  return null;
}

export const INTENT_LABELS: Record<OmiIntent, string> = {
  analyze: 'Analizar con cerebro',
  compare: 'Comparar marcas',
  investigate: 'Disparar research',
  twins: 'Buscar DNA twins',
  news: 'Novedades recientes',
};
