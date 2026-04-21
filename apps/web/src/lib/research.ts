import 'server-only';

export type RunStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface ResearchRun {
  runId: string;
  url: string;
  status: RunStatus;
  brandId: string | null;
  createdAt: string;
  completedAt: string | null;
  resultUrl: string | null;
  streamUrl: string | null;
}

const SEED_RUNS: ResearchRun[] = [
  {
    runId: 'run_seed_001',
    url: 'https://acme.com',
    status: 'done',
    brandId: 'seed-1',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 45_000).toISOString(),
    resultUrl: '/research/run_seed_001',
    streamUrl: null,
  },
  {
    runId: 'run_seed_002',
    url: 'https://novahealth.co',
    status: 'done',
    brandId: 'seed-2',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 12 * 60 * 60 * 1000 + 60_000).toISOString(),
    resultUrl: '/research/run_seed_002',
    streamUrl: null,
  },
  {
    runId: 'run_seed_003',
    url: 'https://peakventures.vc',
    status: 'error',
    brandId: null,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000 + 5_000).toISOString(),
    resultUrl: null,
    streamUrl: null,
  },
];

const BASE = process.env['AQUILA_BASE_URL'] ?? '';
const KEY = process.env['AQUILA_API_KEY'] ?? '';

function aquilaHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

export async function getResearchRuns(
  _workspaceId: string,
): Promise<{ runs: ResearchRun[]; fromSeed: boolean }> {
  if (!BASE || !KEY) return { runs: SEED_RUNS, fromSeed: true };
  try {
    const res = await fetch(`${BASE}/research`, {
      headers: aquilaHeaders(),
      next: { revalidate: 0 },
    });
    if (!res.ok) return { runs: SEED_RUNS, fromSeed: true };
    const data = (await res.json()) as ResearchRun[];
    return { runs: data, fromSeed: false };
  } catch {
    return { runs: SEED_RUNS, fromSeed: true };
  }
}

export async function getResearchRunById(
  runId: string,
): Promise<{ run: ResearchRun; fromSeed: boolean } | null> {
  if (!BASE || !KEY) {
    const seed = SEED_RUNS.find((r) => r.runId === runId) ?? null;
    return seed ? { run: seed, fromSeed: true } : null;
  }
  try {
    const res = await fetch(`${BASE}/research/${runId}`, {
      headers: aquilaHeaders(),
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ResearchRun;
    return { run: data, fromSeed: false };
  } catch {
    return null;
  }
}

export interface CreateRunInput {
  url: string;
  brandId?: string;
  orgSlug: string;
}

export async function createResearchRunRequest(input: CreateRunInput): Promise<ResearchRun | null> {
  if (!BASE || !KEY) return null;
  try {
    const res = await fetch(`${BASE}/research`, {
      method: 'POST',
      headers: aquilaHeaders(),
      body: JSON.stringify({
        url: input.url,
        brand_id: input.brandId ?? null,
        org_id: input.orgSlug,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      run_id: string;
      result_url: string;
      stream_url: string;
    };
    return {
      runId: data.run_id,
      url: input.url,
      status: 'queued',
      brandId: input.brandId ?? null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      resultUrl: data.result_url,
      streamUrl: data.stream_url,
    };
  } catch {
    return null;
  }
}
