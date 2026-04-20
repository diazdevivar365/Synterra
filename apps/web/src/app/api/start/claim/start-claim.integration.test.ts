// Integration test: start/claim DB-layer behaviour.
//
// Requires Docker (Testcontainers pulls postgres:16-alpine).
// Run with:
//   pnpm --filter @synterra/web test:integration
//
// Coverage:
//  - happy path: inflightBootstrap insert → workspace+member create → row claimed
//  - cookie JWT: signWorkspaceJwt round-trips through the real `jose` implementation
//  - slug collision: first insert fails (CONFLICT) → retry with suffix succeeds
//  - row already claimed: workspace switch reads existing workspaceId from the row
//  - expired row: status = 'expired' is stored and readable

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { and, eq } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// `server-only` is a compile-time guard that throws at import time when not in
// a Server Component context. It carries no logic — stub it so the integration
// runner (Node, not Next.js) can import the auth package without bailing.
vi.mock('server-only', () => ({}));

import {
  createDb,
  inflightBootstrap,
  workspaceMembers,
  workspaces,
  type Database,
} from '@synterra/db';
import { signWorkspaceJwt, verifyWorkspaceJwt } from '@synterra/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../../../../../../packages/db/migrations');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function applyMigrations(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS _synterra_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO _synterra_migrations (filename) VALUES (${file})`;
    });
  }
}

// Simulate the DB portion of the claim route's workspace creation path:
// insert workspace → insert owner membership → return workspaceId.
// This mirrors what createWorkspace() does at the DB level.
async function dbCreateWorkspace(
  db: Database,
  { name, slug, userId }: { name: string; slug: string; userId: string },
): Promise<{ ok: true; workspaceId: string } | { ok: false; code: string }> {
  try {
    const [ws] = await db
      .insert(workspaces)
      .values({ name, slug, aquilaOrgSlug: slug })
      .returning({ id: workspaces.id })
      .onConflictDoNothing();

    if (!ws) return { ok: false, code: 'CONFLICT' };

    await db.insert(workspaceMembers).values({ workspaceId: ws.id, userId, role: 'owner' });
    return { ok: true, workspaceId: ws.id };
  } catch {
    return { ok: false, code: 'ERROR' };
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('start/claim — DB-layer integration', { timeout: 120_000 }, () => {
  let container: StartedPostgreSqlContainer;
  let db: Database;

  const userId = '00000000-0000-0000-0001-000000000001';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();

    const sql: Sql = postgres(url, { max: 1 });
    await applyMigrations(sql);

    // Seed a user so the FK constraint on inflight_bootstrap.user_id passes.
    await sql`INSERT INTO users (id, email) VALUES (${userId}, 'claim-test@test.io')`;
    await sql.end();

    db = createDb(url);
  }, 120_000);

  afterAll(async () => {
    await container.stop();
  });

  // -------------------------------------------------------------------------
  it('happy path: inserts bootstrap row, creates workspace+member, marks row claimed', async () => {
    const sessionId = `sess-happy-${Date.now()}`;

    // 1. Insert an inflight_bootstrap row (mirrors bootstrap route behaviour).
    const [row] = await db
      .insert(inflightBootstrap)
      .values({ sessionId, url: 'https://acme.com', ip: '1.2.3.4', status: 'running' })
      .returning({ sessionId: inflightBootstrap.sessionId });

    expect(row?.sessionId).toBe(sessionId);

    // 2. Create workspace + membership (mirrors claim route's createWorkspace call).
    const result = await dbCreateWorkspace(db, {
      name: 'Acme',
      slug: `acme-${Date.now()}`,
      userId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const workspaceId = result.workspaceId;

    // 3. Update the bootstrap row to claimed (mirrors claim route's final db.update).
    await db
      .update(inflightBootstrap)
      .set({ userId, workspaceId, status: 'claimed' })
      .where(eq(inflightBootstrap.sessionId, sessionId));

    // 4. Verify the row reflects claimed state.
    const [claimed] = await db
      .select({
        status: inflightBootstrap.status,
        userId: inflightBootstrap.userId,
        workspaceId: inflightBootstrap.workspaceId,
      })
      .from(inflightBootstrap)
      .where(eq(inflightBootstrap.sessionId, sessionId))
      .limit(1);

    expect(claimed?.status).toBe('claimed');
    expect(claimed?.userId).toBe(userId);
    expect(claimed?.workspaceId).toBe(workspaceId);

    // 5. Verify the membership exists.
    const [member] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      );

    expect(member?.role).toBe('owner');
  });

  // -------------------------------------------------------------------------
  it('slug collision: first insert fails (CONFLICT), retry with suffix succeeds', async () => {
    const slug = `collision-${Date.now()}`;

    // First call succeeds.
    const first = await dbCreateWorkspace(db, { name: 'Corp', slug, userId });
    expect(first.ok).toBe(true);

    // Second call with same slug returns CONFLICT (mirrors the first createWorkspace attempt).
    const second = await dbCreateWorkspace(db, { name: 'Corp2', slug, userId });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe('CONFLICT');

    // Retry with a suffixed slug succeeds (mirrors claim route's retry path).
    const suffix = Math.random().toString(36).slice(2, 6);
    const retry = await dbCreateWorkspace(db, {
      name: 'Corp2',
      slug: `${slug}-${suffix}`,
      userId,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;

    // The retried workspace must be a distinct row.
    expect(retry.workspaceId).not.toBe((first as { ok: true; workspaceId: string }).workspaceId);
  });

  // -------------------------------------------------------------------------
  it('row already claimed: workspace switch reads existing workspaceId', async () => {
    const sessionId = `sess-already-claimed-${Date.now()}`;
    const slug = `already-ws-${Date.now()}`;

    // Pre-create workspace + membership.
    const wsResult = await dbCreateWorkspace(db, { name: 'Already', slug, userId });
    expect(wsResult.ok).toBe(true);
    if (!wsResult.ok) return;
    const workspaceId = wsResult.workspaceId;

    // Insert bootstrap row already in claimed state (as the claim route would leave it
    // on a second visit after the first successful claim).
    await db.insert(inflightBootstrap).values({
      sessionId,
      url: 'https://already.com',
      ip: '5.5.5.5',
      status: 'claimed',
      userId,
      workspaceId,
    });

    // The claim route reads the row and — when status=claimed and workspaceId set —
    // calls switchToWorkspace without creating a new workspace.
    const [row] = await db
      .select({
        status: inflightBootstrap.status,
        workspaceId: inflightBootstrap.workspaceId,
      })
      .from(inflightBootstrap)
      .where(eq(inflightBootstrap.sessionId, sessionId))
      .limit(1);

    expect(row?.status).toBe('claimed');
    expect(row?.workspaceId).toBe(workspaceId);

    // switchToWorkspace inner query: joins workspaceMembers → workspaces.
    const [member] = await db
      .select({ role: workspaceMembers.role, slug: workspaces.slug })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.isDisabled, false),
        ),
      )
      .limit(1);

    expect(member?.role).toBe('owner');
    expect(member?.slug).toBe(slug);
  });

  // -------------------------------------------------------------------------
  it('expired row: status=expired is stored and readable', async () => {
    const sessionId = `sess-expired-${Date.now()}`;

    await db.insert(inflightBootstrap).values({
      sessionId,
      url: 'https://old.com',
      ip: '9.9.9.9',
      status: 'expired',
    });

    const [row] = await db
      .select({ status: inflightBootstrap.status })
      .from(inflightBootstrap)
      .where(eq(inflightBootstrap.sessionId, sessionId))
      .limit(1);

    // The claim route redirects to /start when status = 'expired' — confirm
    // the DB stores and returns this status value correctly.
    expect(row?.status).toBe('expired');
  });

  // -------------------------------------------------------------------------
  it('workspace JWT round-trip: signWorkspaceJwt + verifyWorkspaceJwt', async () => {
    // The claim route calls signWorkspaceJwt to mint the synterra_wjwt cookie.
    // This test exercises the real jose implementation end-to-end.
    const secret = 'test-secret-at-least-32-chars-long!!';
    const payload = {
      workspaceId: 'ws-integration-test',
      userId,
      role: 'owner' as const,
      slug: 'integration-test',
    };

    const token = await signWorkspaceJwt(payload, secret);
    expect(typeof token).toBe('string');
    // HS256 JWT has exactly 3 base64url segments separated by dots.
    expect(token.split('.').length).toBe(3);

    const verified = await verifyWorkspaceJwt(token, secret);
    expect(verified.workspaceId).toBe(payload.workspaceId);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.role).toBe('owner');
    expect(verified.slug).toBe(payload.slug);
  });
});
