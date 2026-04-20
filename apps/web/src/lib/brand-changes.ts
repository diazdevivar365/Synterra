// Server-side helpers for reading and writing brand_changes rows.
// All queries run inside withWorkspaceContext so Postgres RLS session
// variables are set, satisfying the two-layer tenant isolation invariant (§2).

import { and, desc, eq } from 'drizzle-orm';

import { brandChanges, type BrandChange, withWorkspaceContext } from '@synterra/db';

import { db } from '@/lib/db';

export type { BrandChange } from '@synterra/db';

export type ChangeEventSeverity = 'info' | 'warning' | 'critical';

export interface ChangeEventRow {
  id: string;
  brandId: string;
  eventType: string;
  severity: ChangeEventSeverity;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

const VALID_SEVERITIES = new Set<string>(['info', 'warning', 'critical']);
const MAX_LIMIT = 500;

export function toSeverity(v: string | null | undefined): ChangeEventSeverity {
  if (v && VALID_SEVERITIES.has(v)) return v as ChangeEventSeverity;
  return 'info';
}

function rowToEvent(row: BrandChange): ChangeEventRow {
  return {
    id: row.id,
    brandId: row.brandId,
    eventType: row.eventType,
    severity: toSeverity(row.severity),
    title: row.title,
    description: row.description ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    occurredAt: row.occurredAt,
  };
}

export async function getBrandChanges(
  workspaceId: string,
  brandId: string,
  limit = 50,
): Promise<ChangeEventRow[]> {
  const rows = await withWorkspaceContext(db, { workspaceId }, (tx) =>
    tx
      .select()
      .from(brandChanges)
      .where(and(eq(brandChanges.workspaceId, workspaceId), eq(brandChanges.brandId, brandId)))
      .orderBy(desc(brandChanges.occurredAt))
      .limit(Math.min(limit, MAX_LIMIT)),
  );
  return rows.map(rowToEvent);
}

export async function insertBrandChange(data: {
  workspaceId: string;
  brandId: string;
  eventType: string;
  severity: ChangeEventSeverity;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}): Promise<BrandChange> {
  const [row] = await withWorkspaceContext(db, { workspaceId: data.workspaceId }, (tx) =>
    tx
      .insert(brandChanges)
      .values({
        workspaceId: data.workspaceId,
        brandId: data.brandId,
        eventType: data.eventType,
        severity: data.severity,
        title: data.title,
        description: data.description ?? null,
        metadata: data.metadata ?? {},
        occurredAt: data.occurredAt,
      })
      .returning(),
  );

  if (!row) throw new Error('insert returned no row');
  return row;
}
