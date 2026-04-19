// Workspace lifecycle integration test.
//
// Requires Docker. Run with:
//   pnpm --filter @synterra/web test:integration
//
// Tests the core DB operations for workspace create/update and member
// management using a real Postgres container + full migration set.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { and, eq } from 'drizzle-orm';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, invites, workspaceMembers, workspaces, type Database } from '@synterra/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../../../packages/db/migrations');

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

describe('workspace lifecycle', { timeout: 120_000 }, () => {
  let container: StartedPostgreSqlContainer;
  let db: Database;

  const userId = '00000000-0000-0000-0000-000000000001';
  const user2Id = '00000000-0000-0000-0000-000000000002';
  let workspaceId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();

    const sql: Sql = postgres(url, { max: 1 });
    await applyMigrations(sql);

    await sql`
      INSERT INTO users (id, email) VALUES
        (${userId}, 'owner@test.io'),
        (${user2Id}, 'member@test.io')
    `;
    await sql.end();

    db = createDb(url);
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('creates a workspace and owner membership', async () => {
    const [ws] = await db
      .insert(workspaces)
      .values({ name: 'Test Corp', slug: 'test-corp', aquilaOrgSlug: 'test-corp' })
      .returning({ id: workspaces.id });

    expect(ws?.id).toBeTruthy();
    workspaceId = ws!.id;

    await db.insert(workspaceMembers).values({ workspaceId, userId, role: 'owner' });

    const [member] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));

    expect(member?.role).toBe('owner');
  });

  it('updates workspace name', async () => {
    await db
      .update(workspaces)
      .set({ name: 'Test Corp Renamed', updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));

    const [ws] = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));

    expect(ws?.name).toBe('Test Corp Renamed');
  });

  it('creates an invite and adds member on accept', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(invites).values({
      workspaceId,
      email: 'member@test.io',
      role: 'editor',
      invitedBy: userId,
      tokenHash: 'abc123deadbeef',
      expiresAt,
    });

    await db.insert(workspaceMembers).values({
      workspaceId,
      userId: user2Id,
      role: 'editor',
      invitedBy: userId,
    });

    const [member] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user2Id)));

    expect(member?.role).toBe('editor');
  });

  it('changes member role', async () => {
    await db
      .update(workspaceMembers)
      .set({ role: 'viewer' })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user2Id)));

    const [member] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user2Id)));

    expect(member?.role).toBe('viewer');
  });

  it('removes a member', async () => {
    await db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user2Id)));

    const rows = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user2Id)));

    expect(rows).toHaveLength(0);
  });
});
