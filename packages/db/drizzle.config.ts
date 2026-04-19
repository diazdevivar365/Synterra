// Drizzle-kit config for the Synterra control-plane Postgres schema.
//
// Source of truth: `./src/schema.ts` (re-exports one-file-per-domain modules
// that will land in W0-2). Generated migrations live under `./drizzle/`.

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
});
