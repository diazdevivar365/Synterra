// Forgentic (codename: Synterra) — root Vitest config.
//
// Purpose: aggregate workspace-level Vitest projects (apps/* and packages/*).
// Each workspace ships its own `vitest.config.ts` — this file just unions them
// so `pnpm exec vitest run` from the root exercises the whole monorepo in a
// single pass (useful for IDE integration + local cross-workspace runs).
//
// CI uses `turbo run test` (per-workspace parallelism + caching) instead.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest 3 `projects` — a glob of dirs, each containing its own vitest
    // config. Empty matches are tolerated, so this is safe on a clean repo
    // before `apps/` and `packages/` are populated.
    projects: ['apps/*', 'packages/*'],

    // Default reporter surface. Workspaces can override per-project.
    reporters: process.env['CI'] ? ['default', 'junit', 'github-actions'] : ['default'],
    outputFile: {
      junit: './test-results/junit.xml',
    },

    // Consistent mock hygiene across every project unless a project overrides.
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Coverage: provider + baseline thresholds. Each workspace can tighten.
    // Threshold of 0 here so a fresh clone doesn't fail `--coverage`; real
    // thresholds land in the per-workspace configs.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.next/**',
        '.turbo/**',
        'coverage/**',
        '**/*.config.{ts,mts,cts,js,mjs,cjs}',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/tests/**',
        '**/*.{test,spec}.{ts,tsx,js,jsx}',
        'tests/e2e/**',
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
