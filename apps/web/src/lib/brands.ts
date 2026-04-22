import 'server-only';

import { aquilaFetch } from '@/lib/aquila-server';

import type { ActivityEvent } from '@/components/activity-feed';
import type { DnaScores } from '@/components/dna-radar';

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  positionScore: number;
}

export interface DnaTwin {
  brandId: string;
  tagline: string | null;
  tone: string | null;
  isCompetitor: boolean;
  positioning: string;
  similarityScore: number;
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

// ── Aquila raw shapes ──────────────────────────────────────────────────────

interface AquilaBrandListItem {
  brand_id: string;
  url: string | null;
  tagline: string | null;
  last_run_at: string | null;
  updated_at: string | null;
  inferred_tone: string | null;
  palette: unknown;
  has_dna: boolean;
  has_competitors: boolean;
}

interface AquilaDnaVector {
  tech?: string[];
  font_sig?: string;
  industry?: string;
  tone_text?: string;
  palette_sig?: number[];
  has_embedding?: boolean;
  positioning_preview?: string;
}

interface AquilaBrandDetail {
  brand_id: string;
  url: string | null;
  tagline: string | null;
  meta_description: string | null;
  inferred_tone: string | null;
  inferred_audience: string | null;
  inferred_positioning: string | null;
  palette: unknown;
  tech_stack: unknown;
  last_run_at: string | null;
  updated_at: string | null;
  dna_vector: AquilaDnaVector | string | null;
  competitors: unknown;
  wayback_history: unknown;
}

interface AquilaBrandListResponse {
  items: AquilaBrandListItem[];
  total: number;
}

interface AquilaDnaTwinsResponse {
  brand_id: string;
  twins: {
    brand_id: string;
    tagline: string | null;
    tone: string | null;
    is_competitor: boolean;
    positioning: string;
    similarity_score: number;
  }[];
  status?: string;
}

// ── Seed fallback ──────────────────────────────────────────────────────────

const SEED: Brand[] = [
  {
    id: 'seed-1',
    name: 'Acme Corp',
    domain: 'acme.com',
    healthScore: 78,
    lastScannedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    dna: {
      voiceClarity: 80,
      toneConsistency: 72,
      marketPresence: 65,
      competitivePosition: 58,
      audienceAlignment: 88,
      visualIdentity: 74,
    },
    competitors: [
      { id: 'c1', name: 'RivalCo', domain: 'rivalco.com', positionScore: 82 },
      { id: 'c2', name: 'BetterBrand', domain: 'betterbrand.io', positionScore: 71 },
      { id: 'c3', name: 'MarketLeader', domain: 'marketleader.com', positionScore: 91 },
    ],
    recentActivity: [
      {
        id: 'a1',
        description: 'Brand DNA analysis completed',
        occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        type: 'scan',
      },
      {
        id: 'a2',
        description: 'Competitor MarketLeader updated positioning',
        occurredAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        type: 'change',
      },
      {
        id: 'a3',
        description: 'Voice Clarity improved by 4 points',
        occurredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        type: 'info',
      },
    ],
  },
  {
    id: 'seed-2',
    name: 'Nova Health',
    domain: 'novahealth.co',
    healthScore: 54,
    lastScannedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    dna: {
      voiceClarity: 55,
      toneConsistency: 48,
      marketPresence: 60,
      competitivePosition: 44,
      audienceAlignment: 66,
      visualIdentity: 52,
    },
    competitors: [],
    recentActivity: [],
  },
  {
    id: 'seed-3',
    name: 'Peak Ventures',
    domain: 'peakventures.vc',
    healthScore: 32,
    lastScannedAt: null,
    dna: {
      voiceClarity: 30,
      toneConsistency: 35,
      marketPresence: 28,
      competitivePosition: 38,
      audienceAlignment: 25,
      visualIdentity: 32,
    },
    competitors: [],
    recentActivity: [],
  },
];

// ── Mapping helpers ────────────────────────────────────────────────────────

export function brandNameFromId(brandId: string): string {
  return brandId
    .replace(/-com$|-io$|-net$|-org$|-co$|-app$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function domainFromUrl(url: string | null, brandId: string): string {
  if (!url) return `${brandId}.com`;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return brandId;
  }
}

function parseDnaVector(raw: AquilaDnaVector | string | null): AquilaDnaVector {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as AquilaDnaVector;
    } catch {
      return {};
    }
  }
  return raw;
}

function parseCompetitors(raw: unknown): Competitor[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown[];
          } catch {
            return [];
          }
        })()
      : [];
  return arr
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c, i) => {
      const cid = typeof c['brand_id'] === 'string' ? c['brand_id'] : `comp-${i}`;
      return {
        id: cid,
        name: brandNameFromId(cid),
        domain: domainFromUrl(c['url'] as string | null, cid),
        positionScore: 50,
      };
    });
}

function paletteLength(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === 'string') {
    try {
      return (JSON.parse(raw) as unknown[]).length;
    } catch {
      return 0;
    }
  }
  return 0;
}

function computeDnaScores(dna: AquilaDnaVector, detail?: Partial<AquilaBrandDetail>): DnaScores {
  const hasTone = !!(dna.tone_text ?? detail?.inferred_tone);
  const hasPositioning = !!(dna.positioning_preview ?? detail?.inferred_positioning);
  const hasAudience = !!detail?.inferred_audience;
  const techCount = (dna.tech ?? []).length;
  const paletteFilled = (dna.palette_sig ?? []).some((v) => v !== 0);
  const hasEmbedding = dna.has_embedding ?? false;

  return {
    voiceClarity: hasPositioning ? 72 + Math.min(techCount * 2, 15) : 28,
    toneConsistency: hasTone ? 68 + (hasEmbedding ? 10 : 0) : 24,
    marketPresence: techCount > 2 ? 60 + Math.min(techCount * 3, 25) : 35,
    competitivePosition: hasEmbedding ? 65 : 30,
    audienceAlignment: hasAudience ? 70 : 32,
    visualIdentity: paletteFilled ? 74 : 28,
  };
}

function mapListItemToBrand(item: AquilaBrandListItem): Brand {
  let healthScore = 0;
  if (item.has_dna) healthScore += 40;
  if (item.has_competitors) healthScore += 20;
  if (item.inferred_tone) healthScore += 20;
  if (paletteLength(item.palette) > 0) healthScore += 20;

  return {
    id: item.brand_id,
    name: brandNameFromId(item.brand_id),
    domain: domainFromUrl(item.url, item.brand_id),
    healthScore,
    lastScannedAt: item.last_run_at ? new Date(item.last_run_at) : null,
    dna: computeDnaScores({}, item),
    competitors: [],
    recentActivity: [],
  };
}

function mapDetailToBrand(raw: AquilaBrandDetail): Brand {
  const dnaVec = parseDnaVector(raw.dna_vector);
  const competitors = parseCompetitors(raw.competitors);

  let healthScore = 0;
  if (raw.dna_vector) healthScore += 40;
  if (competitors.length > 0) healthScore += 20;
  if (raw.inferred_tone) healthScore += 20;
  if (paletteLength(raw.palette) > 0) healthScore += 20;

  const activity: ActivityEvent[] = [];
  if (raw.last_run_at) {
    activity.push({
      id: 'scan-last',
      description: 'Brand research scan completed',
      occurredAt: new Date(raw.last_run_at),
      type: 'scan',
    });
  }
  if (dnaVec.has_embedding) {
    activity.push({
      id: 'dna-ready',
      description: 'DNA embedding computed',
      occurredAt: new Date(raw.updated_at ?? Date.now()),
      type: 'info',
    });
  }

  return {
    id: raw.brand_id,
    name: brandNameFromId(raw.brand_id),
    domain: domainFromUrl(raw.url, raw.brand_id),
    healthScore,
    lastScannedAt: raw.last_run_at ? new Date(raw.last_run_at) : null,
    dna: computeDnaScores(dnaVec, raw),
    competitors,
    recentActivity: activity,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getBrandsForWorkspace(
  workspaceId: string,
): Promise<{ brands: Brand[]; fromSeed: boolean }> {
  const data = await aquilaFetch<AquilaBrandListResponse>(workspaceId, '/brands?limit=100');
  if (data?.items.length) {
    return { brands: data.items.map(mapListItemToBrand), fromSeed: false };
  }
  return { brands: SEED, fromSeed: true };
}

export async function getBrandById(
  workspaceId: string,
  brandId: string,
): Promise<{ brand: Brand; fromSeed: boolean } | null> {
  const data = await aquilaFetch<AquilaBrandDetail>(
    workspaceId,
    `/brands/${encodeURIComponent(brandId)}`,
  );
  if (data?.brand_id) {
    return { brand: mapDetailToBrand(data), fromSeed: false };
  }
  const seed = SEED.find((b) => b.id === brandId);
  if (!seed) return null;
  return { brand: seed, fromSeed: true };
}

export interface BrandSnapshot {
  date: string;
  tagline: string | null;
  tone: string | null;
  positioning: string | null;
}

export interface WaybackSnapshot {
  date: string;
  snapshotUrl: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  paletteHex: string[];
}

export interface BrandTimeline {
  brandSnapshots: BrandSnapshot[];
  waybackSnapshots: WaybackSnapshot[];
  waybackSyncedAt: string | null;
  totalBrandSnapshots: number;
}

export async function getBrandTimeline(
  workspaceId: string,
  brandId: string,
): Promise<BrandTimeline | null> {
  const [timelineData, historyData] = await Promise.all([
    aquilaFetch<{
      brand_id: string;
      snapshots: { date: string; data: Record<string, unknown> }[];
      total_snapshots: number;
    }>(workspaceId, `/brands/${encodeURIComponent(brandId)}/timeline`),
    aquilaFetch<{
      brand_id: string;
      url: string | null;
      synced_at: string | null;
      history: {
        snapshots?: {
          date: string;
          snapshot_url?: string;
          title?: string;
          meta_description?: string;
          h1?: string;
          palette_hex?: string[];
        }[];
        change_events?: unknown[];
      } | null;
    }>(workspaceId, `/brands/${encodeURIComponent(brandId)}/history`),
  ]);

  if (!timelineData && !historyData) return null;

  const brandSnapshots: BrandSnapshot[] = (timelineData?.snapshots ?? []).map((s) => ({
    date: s.date,
    tagline: typeof s.data['tagline'] === 'string' ? s.data['tagline'] : '',
    tone: typeof s.data['inferred_tone'] === 'string' ? s.data['inferred_tone'] : '',
    positioning:
      typeof s.data['inferred_positioning'] === 'string' ? s.data['inferred_positioning'] : '',
  }));

  const waybackSnapshots: WaybackSnapshot[] = (historyData?.history?.snapshots ?? []).map((s) => ({
    date: s.date,
    snapshotUrl: s.snapshot_url ?? '',
    title: s.title ?? null,
    metaDescription: s.meta_description ?? null,
    h1: s.h1 ?? null,
    paletteHex: s.palette_hex ?? [],
  }));

  return {
    brandSnapshots,
    waybackSnapshots,
    waybackSyncedAt: historyData?.synced_at ?? null,
    totalBrandSnapshots: timelineData?.total_snapshots ?? 0,
  };
}

export interface IgPost {
  caption: string;
  timestamp: number | null;
  likes: number;
  comments: number;
  imageUrl: string | null;
  shortcode: string | null;
  isVideo: boolean;
}

export interface IgProfile {
  handle: string | null;
  name: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  verified: boolean;
  externalUrl: string | null;
  profilePic: string | null;
  isBusinessAccount: boolean;
  businessCategory: string | null;
  engagementRate: number | null;
  postFrequencyDays: number | null;
  recentPosts: IgPost[];
  scannedAt: string | null;
}

export interface IgHistoryPoint {
  capturedAt: string;
  followers: number | null;
  engagementRate: number | null;
  postsCount: number | null;
  visualConsistencyScore: number | null;
}

export type QualityStatus = 'ok' | 'fixed' | 'issue';

export interface QualityField {
  status: QualityStatus;
  reason: string | null;
  actionTaken: string | null;
  removedCount: number;
  auditSource: string | null;
  auditedAt: string | null;
}

export type BrandQuality = Record<string, QualityField>;

export interface BrandGraph {
  brand: Record<string, unknown>;
  tech: Record<string, unknown>[];
  social: Record<string, unknown>[];
  tags: Record<string, unknown>[];
  industries: Record<string, unknown>[];
  products: Record<string, unknown>[];
  persons: Record<string, unknown>[];
  competitors: Record<string, unknown>[];
  domains: Record<string, unknown>[];
}

export async function getBrandGraph(
  workspaceId: string,
  brandId: string,
): Promise<BrandGraph | null> {
  return aquilaFetch<BrandGraph>(workspaceId, `/brands/${encodeURIComponent(brandId)}/graph`);
}

export async function getBrandQuality(
  workspaceId: string,
  brandId: string,
): Promise<BrandQuality | null> {
  const data = await aquilaFetch<{
    brand_id: string;
    fields: Record<
      string,
      {
        status: QualityStatus;
        reason: string | null;
        action_taken: string | null;
        removed_count: number;
        audit_source: string | null;
        audited_at: string | null;
      }
    >;
  }>(workspaceId, `/brands/${encodeURIComponent(brandId)}/quality`);
  if (!data) return null;
  const result: BrandQuality = {};
  for (const [key, val] of Object.entries(data.fields)) {
    result[key] = {
      status: val.status,
      reason: val.reason,
      actionTaken: val.action_taken,
      removedCount: val.removed_count,
      auditSource: val.audit_source,
      auditedAt: val.audited_at,
    };
  }
  return result;
}

export async function getBrandInstagram(
  workspaceId: string,
  brandId: string,
): Promise<{ profile: IgProfile; history: IgHistoryPoint[] } | null> {
  const [igData, histData] = await Promise.all([
    aquilaFetch<{
      brand_id: string;
      handle: string | null;
      scanned_at: string | null;
      data: {
        name?: string;
        bio?: string;
        followers?: number;
        following?: number;
        posts_count?: number;
        verified?: boolean;
        external_url?: string;
        profile_pic?: string;
        is_business?: boolean;
        business_category?: string;
        engagement_rate?: number;
        post_frequency_days?: number;
        recent_posts?: {
          caption?: string;
          timestamp?: number;
          likes?: number;
          comments?: number;
          image_url?: string;
          shortcode?: string;
          is_video?: boolean;
        }[];
      };
    }>(workspaceId, `/brands/${encodeURIComponent(brandId)}/instagram`),
    aquilaFetch<{
      count: number;
      snapshots: {
        captured_at: string;
        followers: number | null;
        engagement_rate: number | null;
        posts_count: number | null;
        visual_consistency_score: number | null;
      }[];
    }>(workspaceId, `/brands/${encodeURIComponent(brandId)}/instagram/history?limit=30`),
  ]);

  if (!igData) return null;

  const d = igData.data;
  const profile: IgProfile = {
    handle: igData.handle,
    name: d.name ?? null,
    bio: d.bio ?? null,
    followers: d.followers ?? null,
    following: d.following ?? null,
    postsCount: d.posts_count ?? null,
    verified: d.verified ?? false,
    externalUrl: d.external_url ?? null,
    profilePic: d.profile_pic ?? null,
    isBusinessAccount: d.is_business ?? false,
    businessCategory: d.business_category ?? null,
    engagementRate: d.engagement_rate ?? null,
    postFrequencyDays: d.post_frequency_days ?? null,
    recentPosts: (d.recent_posts ?? []).map((p) => ({
      caption: p.caption ?? '',
      timestamp: p.timestamp ?? null,
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      imageUrl: p.image_url ?? null,
      shortcode: p.shortcode ?? null,
      isVideo: p.is_video ?? false,
    })),
    scannedAt: igData.scanned_at,
  };

  const history: IgHistoryPoint[] = (histData?.snapshots ?? []).map((s) => ({
    capturedAt: s.captured_at,
    followers: s.followers,
    engagementRate: s.engagement_rate,
    postsCount: s.posts_count,
    visualConsistencyScore: s.visual_consistency_score,
  }));

  return { profile, history };
}

export async function getBrandDnaTwins(
  workspaceId: string,
  brandId: string,
): Promise<DnaTwin[] | null> {
  const data = await aquilaFetch<AquilaDnaTwinsResponse>(
    workspaceId,
    `/brands/${encodeURIComponent(brandId)}/dna-twins?limit=8`,
  );
  if (!data) return null;
  if (data.status === 'dna_not_computed' || !data.twins.length) return [];
  return data.twins.map((t) => ({
    brandId: t.brand_id,
    tagline: t.tagline,
    tone: t.tone,
    isCompetitor: t.is_competitor,
    positioning: t.positioning,
    similarityScore: t.similarity_score,
  }));
}

export interface BrandDnaData {
  brandId: string;
  techStack: string[];
  fontSignature: string | null;
  industry: string | null;
  paletteSignature: number[];
  updatedAt: string;
}

export async function getFullBrandDna(
  workspaceId: string,
  brandId: string,
): Promise<BrandDnaData | null> {
  const data = await aquilaFetch<{
    brand_id: string;
    tech_stack: string[];
    font_signature: string | null;
    industry: string | null;
    palette_signature: number[];
    updated_at: string;
  }>(workspaceId, `/brands/${encodeURIComponent(brandId)}/dna`);
  if (!data) return null;
  return {
    brandId: data.brand_id,
    techStack: data.tech_stack,
    fontSignature: data.font_signature,
    industry: data.industry,
    paletteSignature: data.palette_signature,
    updatedAt: data.updated_at,
  };
}

export interface HeatmapPoint {
  brandId: string;
  url: string;
  tagline: string | null;
  tone: string | null;
  audience: string | null;
  positioning: string;
  industry: string | null;
  tech: string[];
  x: number;
  y: number;
}

export interface Heatmap {
  method: string;
  nBrands: number;
  points: HeatmapPoint[];
}

export async function getHeatmap(workspaceId: string): Promise<Heatmap | null> {
  const data = await aquilaFetch<{
    method: string;
    n_brands: number;
    dims_in: number;
    points: {
      brand_id: string;
      url: string;
      tagline: string | null;
      tone: string | null;
      audience: string | null;
      positioning: string;
      industry: string | null;
      tech: string[];
      x: number;
      y: number;
    }[];
  }>(workspaceId, '/brands/heatmap/scatter?method=pca');
  if (!data) return null;
  return {
    method: data.method,
    nBrands: data.n_brands,
    points: data.points.map((p) => ({
      brandId: p.brand_id,
      url: p.url,
      tagline: p.tagline,
      tone: p.tone,
      audience: p.audience,
      positioning: p.positioning,
      industry: p.industry,
      tech: p.tech,
      x: p.x,
      y: p.y,
    })),
  };
}

export interface AdSample {
  id?: string;
  headline?: string;
  body?: string;
  cta?: string;
  image_url?: string;
  format?: string;
  started_at?: string;
}

export interface AdSourceData {
  count: number;
  samples: AdSample[];
}

export interface AdsAiAnalysis {
  dominant_messages?: string[];
  creative_formats?: string[];
  text_overlay_style?: string;
  color_palette_summary?: string;
  production_quality?: string;
  emotional_triggers?: string[];
}

export interface BrandAdsData {
  sources?: {
    meta_ads?: AdSourceData;
    tiktok_ads?: AdSourceData;
  };
  ai_analysis?: AdsAiAnalysis;
  geo?: string;
  scanned_at?: string;
}

export async function getBrandAds(
  workspaceId: string,
  brandId: string,
): Promise<BrandAdsData | null> {
  const data = await aquilaFetch<Record<string, unknown>>(
    workspaceId,
    `/brands/${encodeURIComponent(brandId)}`,
  );
  if (!data) return null;
  return (data['ads_data'] as BrandAdsData | null | undefined) ?? null;
}

export interface PricingPlan {
  name: string;
  price: number | null;
  billing_period?: string;
  features: string[];
}

export interface BrandPricingData {
  has_pricing: boolean;
  currency?: string;
  billing_period?: string;
  plans: PricingPlan[];
  source_url?: string;
  analyzed_at?: string;
}

export async function getBrandPricing(
  workspaceId: string,
  brandId: string,
): Promise<BrandPricingData | null> {
  const data = await aquilaFetch<Record<string, unknown>>(
    workspaceId,
    `/brands/${encodeURIComponent(brandId)}`,
  );
  if (!data) return null;
  const pd = data['pricing_data'] as BrandPricingData | null | undefined;
  return pd ?? null;
}
