#!/usr/bin/env tsx
// Applies SQL migrations from packages/db/migrations/ to the target Postgres DB.
// Tracks applied migrations in _synterra_migrations to stay idempotent.
//
// Usage: DATABASE_URL=postgres://... pnpm db:migrate

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const migrationsDir = join(fileURLToPath(import.meta.url), '../../migrations');

await sql`
  CREATE TABLE IF NOT EXISTS _synterra_migrations (
    id          SERIAL PRIMARY KEY,
    filename    TEXT NOT NULL UNIQUE,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  const [row] = await sql`
    SELECT 1 FROM _synterra_migrations WHERE filename = ${file}
  `;
  if (row) {
    console.log(`skip  ${file}`);
    continue;
  }
  const content = await readFile(join(migrationsDir, file), 'utf8');
  await sql.begin(async (tx) => {
    await tx.unsafe(content);
    await tx`INSERT INTO _synterra_migrations (filename) VALUES (${file})`;
  });
  console.log(`ok    ${file}`);
}

await sql.end();
console.log('Migrations complete.');
