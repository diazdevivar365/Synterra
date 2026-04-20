// apps/web/src/lib/brand-changes.ts
//
// Server-side helpers for reading and writing brand_changes rows.
// All queries must include workspace_id in the WHERE clause (architectural invariant §2).

import { and, desc, eq } from 'drizzle-orm';

import { brandChanges, type BrandChange } from '@synterra/db';

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

function rowToEvent(row: BrandChange): ChangeEventRow {
  return {
    id: row.id,
    brandId: row.brandId,
    eventType: row.eventType,
    severity: row.severity as ChangeEventSeverity,
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
  const rows = await db
    .select()
    .from(brandChanges)
    .where(
      and(
        eq(brandChanges.workspaceId, workspaceId),
        eq(brandChanges.brandId, brandId),
      ),
    )
    .orderBy(desc(brandChanges.occurredAt))
    .limit(limit);

  return rows.map(rowToEvent);
}

export async function insertBrandChange(data: {
  workspaceId: string;
  brandId: string;
  eventType: string;
  severity: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}): Promise<BrandChange> {
  const [row] = await db
    .insert(brandChanges)
    .values({
      workspaceId: data.workspaceId,
      brandId: data.brandId,
      eventType: data.eventType,
      severity: data.severity as ChangeEventSeverity,
      title: data.title,
      description: data.description ?? null,
      metadata: data.metadata ?? {},
      occurredAt: data.occurredAt,
    })
    .returning();

  if (!row) throw new Error('insert returned no row');
  return row;
}
