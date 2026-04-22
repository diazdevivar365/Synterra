import { aquilaFetch } from '@/lib/aquila-server';

export interface GlossaryTerm {
  slug: string;
  term: string;
  domain: string;
  definition: string;
  synonyms: string[];
  related_terms: string[];
  sources: string[];
  updated_at: string;
}

interface GlossaryResponse {
  items: GlossaryTerm[];
  count: number;
}

export async function getGlossaryTerms(
  wsId: string,
  opts?: { q?: string | undefined; domain?: string | undefined },
): Promise<GlossaryTerm[]> {
  const params = new URLSearchParams();
  if (opts?.q) params.set('q', opts.q);
  if (opts?.domain) params.set('domain', opts.domain);
  const qs = params.toString();

  const data = await aquilaFetch<GlossaryResponse>(wsId, `/glossary${qs ? `?${qs}` : ''}`);
  return data?.items ?? [];
}
