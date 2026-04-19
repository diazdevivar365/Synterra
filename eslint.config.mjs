// Forgentic (codename: Synterra) — ESLint 9 flat config (root).
//
// Strategy:
// - Strict TypeScript linting with type-aware rules via typescript-eslint v8
//   `projectService` (auto-discovers each workspace's tsconfig.json).
// - Import-ordering + unused-import hygiene across the whole monorepo.
// - Next.js + core-web-vitals rules scoped to `apps/web/**` only.
// - Node globals for `apps/api`, `apps/workers`, `packages/**`, tooling.
// - Test files relax a small set of type-assertion rules where they get noisy.
// - `eslint-config-prettier` goes LAST to disable any stylistic rule that
//   would otherwise fight with Prettier.
//
// Per-workspace linting is invoked via `turbo run lint` → each workspace
// defines `"lint": "eslint . --max-warnings=0"`. ESLint picks up this root
// config automatically (flat config file discovery walks upward).

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import nextPlugin from '@next/eslint-plugin-next';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // 1. Global ignores — anything below is never linted.
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/blob-report/**',
      '**/drizzle/**/*.sql',
      '**/*.min.js',
      '**/next-env.d.ts',
      'pnpm-lock.yaml',
    ],
  },

  // 2. Base JS recommended — applies to every file ESLint sees.
  js.configs.recommended,

  // 3. TypeScript: strict + type-checked rules on *.ts / *.tsx.
  //    `projectService: true` delegates project-resolution to TS's own service,
  //    which auto-finds each workspace's tsconfig without us listing them.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Defer unused-var warnings to eslint-plugin-unused-imports so we get
      // a single, consistent behaviour + auto-fix.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],
    },
  },

  // 4. Plain JS/MJS/CJS files — no type-aware linting (config files, scripts).
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // 5. Import-plugin — order, no-cycle, no-duplicates across the repo.
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            './tsconfig.json',
            './apps/*/tsconfig.json',
            './packages/*/tsconfig.json',
          ],
        },
        node: true,
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
      },
    },
    rules: {
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/no-self-import': 'error',
      'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
      'import/no-useless-path-segments': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            {
              pattern: '@synterra/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin', 'type'],
        },
      ],
    },
  },

  // 6. Unused imports — auto-remove unused imports, warn on unused locals.
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // 7. Node environment — api / workers / packages / tooling.
  {
    files: [
      'apps/api/**/*.{ts,tsx,js,mjs,cjs}',
      'apps/workers/**/*.{ts,tsx,js,mjs,cjs}',
      'packages/**/*.{ts,tsx,js,mjs,cjs}',
      'scripts/**/*.{ts,js,mjs,cjs}',
      '*.config.{js,mjs,cjs,ts}',
      'tests/**/*.{ts,js}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // 8. Browser + Next.js — apps/web only.
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    plugins: { '@next/next': nextPlugin },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // 9. Test files — unit, integration, E2E — loosen the strictest type rules.
  {
    files: [
      '**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts}',
      '**/tests/**/*.{ts,tsx,js,jsx,mts,cts}',
      '**/__tests__/**/*.{ts,tsx,js,jsx,mts,cts}',
      'tests/e2e/**/*.{ts,js}',
    ],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // 10. Declaration files — ambient types, relax unused-rules.
  {
    files: ['**/*.d.ts'],
    rules: {
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // 11. Prettier compat — MUST be last. Disables stylistic rules that clash.
  prettierConfig,
);
