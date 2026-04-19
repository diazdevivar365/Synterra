import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      exclude: ['**/*.config.*', '**/*.d.ts', 'src/app/layout.tsx', '.next/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@synterra/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@synterra/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      'drizzle-orm': path.resolve(__dirname, 'node_modules/@synterra/db/node_modules/drizzle-orm'),
      postgres: path.resolve(__dirname, 'node_modules/@synterra/db/node_modules/postgres'),
    },
  },
});
