import type { ActivityEvent } from '@/components/activity-feed';
import type { DnaScores } from '@/components/dna-radar';

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  positionScore: number;
}

export interface Brand {
  id: string;
  name: string;
  domain: string;
  healthScore: number;
  lastScannedAt: Date | null;
  dna: DnaScores;
  competitors: Competitor[];
  recentActivity: ActivityEvent[];
}

const SEED: Brand[] = [
  {
    id: 'seed-1',
    name: 'Acme Corp',
    domain: 'acme.com',
    healthScore: 78,
    lastScannedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    dna: { voiceClarity: 80, toneConsistency: 72, marketPresence: 65, competitivePosition: 58, audienceAlignment: 88, visualIdentity: 74 },
    competitors: [
      { id: 'c1', name: 'RivalCo',      domain: 'rivalco.com',      positionScore: 82 },
      { id: 'c2', name: 'BetterBrand',  domain: 'betterbrand.io',   positionScore: 71 },
      { id: 'c3', name: 'MarketLeader', domain: 'marketleader.com', positionScore: 91 },
    ],
    recentActivity: [
      { id: 'a1', description: 'Brand DNA analysis completed',               occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),  type: 'scan'   },
      { id: 'a2', description: 'Competitor MarketLeader updated positioning', occurredAt: new Date(Date.now() - 5 * 60 * 60 * 1000),  type: 'change' },
      { id: 'a3', description: 'Voice Clarity improved by 4 points',         occurredAt: new Date(Date.now() - 24 * 60 * 60 * 1000), type: 'info'   },
    ],
  },
  {
    id: 'seed-2',
    name: 'Nova Health',
    domain: 'novahealth.co',
    healthScore: 54,
    lastScannedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    dna: { voiceClarity: 55, toneConsistency: 48, marketPresence: 60, competitivePosition: 44, audienceAlignment: 66, visualIdentity: 52 },
    competitors: [],
    recentActivity: [],
  },
  {
    id: 'seed-3',
    name: 'Peak Ventures',
    domain: 'peakventures.vc',
    healthScore: 32,
    lastScannedAt: null,
    dna: { voiceClarity: 30, toneConsistency: 35, marketPresence: 28, competitivePosition: 38, audienceAlignment: 25, visualIdentity: 32 },
    competitors: [],
    recentActivity: [],
  },
];

const BASE = process.env['AQUILA_BASE_URL'] ?? '';
const KEY  = process.env['AQUILA_API_KEY']  ?? '';

async function aquilaGet<T>(path: string): Promise<T | null> {
  if (!BASE || !KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${KEY}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getBrandsForWorkspace(
  workspaceId: string,
): Promise<{ brands: Brand[]; fromSeed: boolean }> {
  const data = await aquilaGet<Brand[]>(`/v1/workspaces/${workspaceId}/brands`);
  if (data) return { brands: data, fromSeed: false };
  return { brands: SEED, fromSeed: true };
}

export async function getBrandById(
  workspaceId: string,
  brandId: string,
): Promise<{ brand: Brand; fromSeed: boolean } | null> {
  const data = await aquilaGet<Brand>(`/v1/workspaces/${workspaceId}/brands/${brandId}`);
  if (data) return { brand: data, fromSeed: false };
  const seed = SEED.find((b) => b.id === brandId);
  if (!seed) return null;
  return { brand: seed, fromSeed: true };
}
