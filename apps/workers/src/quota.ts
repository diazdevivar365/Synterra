// Quota lifecycle + enforcement helpers.
//
// RULES (billing-engineer invariants):
//   - consumeCredits: insert usage_events + update workspace_quotas in ONE transaction.
//   - Missing quota row => fail-closed (allowed: false).
//   - Append-only: never UPDATE usage_events.
//   - Enterprise (creditsGranted = -1) => unlimited, never blocked.

import { eq } from 'drizzle-orm';

import { getPlanBySlug } from '@synterra/billing';
import { usageEvents, workspaceQuotas, type Database } from '@synterra/db';

const SOFT_LIMIT_RATIO = 0.8;

export interface ConsumeCreditsEvent {
  eventType: string;
  resourceId?: string;
  userId?: string;
  metadata?: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
}

export interface ConsumeCreditsResult {
  allowed: boolean;
  hardLimitReached: boolean;
  softLimitReached: boolean;
  reason: 'no_quota_row' | 'hard_limit_reached' | 'duplicate_event' | 'ok';
  creditsGranted?: number;
  creditsConsumed?: number;
}

/**
 * Transactional credit debit. Atomically inserts a usage_events row and
 * increments workspace_quotas.credits_consumed. Blocks at hard limit (100%).
 *
 * CRITICAL: insert + update run in the same db.transaction(). No exceptions.
 */
export async function consumeCredits(
  db: Database,
  workspaceId: string,
  cost: number,
  event: ConsumeCreditsEvent,
): Promise<ConsumeCreditsResult> {
  if (!Number.isInteger(cost) || cost < 0) {
    throw new Error(`consumeCredits: cost must be a non-negative integer, got ${cost}`);
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(workspaceQuotas)
      .where(eq(workspaceQuotas.workspaceId, workspaceId))
      .for('update');

    const row = rows[0];
    if (!row) {
      return {
        allowed: false,
        hardLimitReached: false,
        softLimitReached: false,
        reason: 'no_quota_row' as const,
      };
    }

    const unlimited = row.creditsGranted < 0;
    const newConsumed = row.creditsConsumed + cost;
    const softLimitReached = unlimited
      ? false
      : newConsumed >= Math.floor(row.creditsGranted * SOFT_LIMIT_RATIO);
    const hardLimitReached = unlimited ? false : newConsumed > row.creditsGranted;

    if (hardLimitReached) {
      await tx
        .update(workspaceQuotas)
        .set({ hardLimitReached: true, softLimitReached: true, updatedAt: new Date() })
        .where(eq(workspaceQuotas.workspaceId, workspaceId));
      return {
        allowed: false,
        hardLimitReached: true,
        softLimitReached: true,
        reason: 'hard_limit_reached' as const,
        creditsGranted: row.creditsGranted,
        creditsConsumed: row.creditsConsumed,
      };
    }

    try {
      await tx.insert(usageEvents).values({
        workspaceId,
        userId: event.userId,
        eventType: event.eventType,
        resourceId: event.resourceId,
        quantity: 1,
        costCredits: cost,
        metadata: (event.metadata ?? {}) as Record<string, unknown>,
        idempotencyKey: event.idempotencyKey,
      });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return {
          allowed: true,
          hardLimitReached: false,
          softLimitReached: false,
          reason: 'duplicate_event' as const,
          creditsGranted: row.creditsGranted,
          creditsConsumed: row.creditsConsumed,
        };
      }
      throw err;
    }

    await tx
      .update(workspaceQuotas)
      .set({
        creditsConsumed: newConsumed,
        softLimitReached,
        hardLimitReached,
        updatedAt: new Date(),
      })
      .where(eq(workspaceQuotas.workspaceId, workspaceId));

    return {
      allowed: true,
      hardLimitReached,
      softLimitReached,
      reason: 'ok' as const,
      creditsGranted: row.creditsGranted,
      creditsConsumed: newConsumed,
    };
  });
}

/**
 * Seed (or refresh) the workspace_quotas row for a given subscription period.
 * Idempotent — safe to call from webhook retries.
 *
 * Callers must be inside a transaction (e.g. serviceRoleQuery) so the seed is
 * atomic with the subscription upsert. Does NOT wrap in its own transaction.
 */
export async function seedWorkspaceQuota(
  db: Database,
  workspaceId: string,
  planSlug: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  const plan = getPlanBySlug(planSlug);
  if (!plan) {
    throw new Error(`seedWorkspaceQuota: unknown plan slug "${planSlug}"`);
  }
  const monthlyCredits = plan.quotas.monthlyCredits;

  await db
    .insert(workspaceQuotas)
    .values({
      workspaceId,
      periodStart,
      periodEnd,
      creditsGranted: monthlyCredits,
      creditsConsumed: 0,
      softLimitReached: false,
      hardLimitReached: false,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: workspaceQuotas.workspaceId,
      set: {
        periodStart,
        periodEnd,
        creditsGranted: monthlyCredits,
        creditsConsumed: 0,
        softLimitReached: false,
        hardLimitReached: false,
        updatedAt: new Date(),
      },
    });
}
