// RLS cross-workspace isolation integration test.
//
// Requires Docker. Run explicitly with:
//   pnpm --filter @synterra/db vitest run rls.integration
//
// Verifies that Postgres RLS on `workspaces` and `workspace_members` denies
// cross-tenant reads when connected as a non-superuser (the only role that RLS
// actually constrains).

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../migrations');

// ─── helpers ────────────────────────────────────────────────────────────────

async function applyMigrations(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS _synterra_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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

// ─── suite ──────────────────────────────────────────────────────────────────

describe('RLS cross-workspace denial', { timeout: 120_000 }, () => {
  let container: StartedPostgreSqlContainer;
  let adminSql: Sql;
  let appSql: Sql; // non-superuser — RLS applies here

  let wsAId: string;
  let wsBId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16.6-alpine')
      .withStartupTimeout(90_000)
      .start();

    adminSql = postgres(container.getConnectionUri(), { max: 1 });

    await applyMigrations(adminSql);

    // Create a non-superuser that RLS actually constrains.
    const dbName = container.getDatabase();
    await adminSql`CREATE ROLE app_user LOGIN PASSWORD 'test'`;
    await adminSql.unsafe(`GRANT CONNECT ON DATABASE "${dbName}" TO app_user`);
    await adminSql`GRANT USAGE ON SCHEMA public TO app_user`;
    await adminSql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`;
    await adminSql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user`;

    // Seed: two users
    const [rowA] = await adminSql<[{ id: string }]>`
      INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice')
      RETURNING id
    `;
    const [rowB] = await adminSql<[{ id: string }]>`
      INSERT INTO users (email, name) VALUES ('bob@example.com', 'Bob')
      RETURNING id
    `;
    userAId = rowA.id;
    userBId = rowB.id;

    // Seed: two workspaces
    const [wsA] = await adminSql<[{ id: string }]>`
      INSERT INTO workspaces (slug, name, aquila_org_slug)
      VALUES ('ws-alpha', 'Alpha', 'alpha-org')
      RETURNING id
    `;
    const [wsB] = await adminSql<[{ id: string }]>`
      INSERT INTO workspaces (slug, name, aquila_org_slug)
      VALUES ('ws-beta', 'Beta', 'beta-org')
      RETURNING id
    `;
    wsAId = wsA.id;
    wsBId = wsB.id;

    // Seed: each user is member of their own workspace only
    await adminSql`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (${wsAId}, ${userAId}, 'owner')
    `;
    await adminSql`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (${wsBId}, ${userBId}, 'owner')
    `;

    appSql = postgres(
      container.getConnectionUri().replace(/\/[^/]+$/, `/${container.getDatabase()}`),
      { max: 2, username: 'app_user', password: 'test' },
    );
  });

  afterAll(async () => {
    await appSql.end();
    await adminSql.end();
    await container.stop();
  });

  it('workspace context only surfaces own workspace', async () => {
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('synterra.workspace_id', ${wsAId}, true)`;
      await tx`SELECT set_config('synterra.user_id', ${userAId}, true)`;
      return tx<{ slug: string }[]>`SELECT slug FROM workspaces ORDER BY slug`;
    });

    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain('ws-alpha');
    expect(slugs).not.toContain('ws-beta');
  });

  it('cross-workspace context is denied — workspace B context cannot see workspace A', async () => {
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('synterra.workspace_id', ${wsBId}, true)`;
      await tx`SELECT set_config('synterra.user_id', ${userBId}, true)`;
      return tx<{ slug: string }[]>`SELECT slug FROM workspaces ORDER BY slug`;
    });

    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain('ws-beta');
    expect(slugs).not.toContain('ws-alpha');
  });

  it('no context set — non-superuser sees no workspaces', async () => {
    const rows = await appSql<{ slug: string }[]>`SELECT slug FROM workspaces ORDER BY slug`;
    // RLS with no synterra.workspace_id set: current_setting returns '' which
    // won't match any workspace id, and the user has no memberships query active.
    expect(rows).toHaveLength(0);
  });
});
