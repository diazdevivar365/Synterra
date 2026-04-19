import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      // server-only throws in non-Next.js test environments; stub it out.
      'server-only': path.resolve(__dirname, 'src/__mocks__/server-only.ts'),
    },
  },
});
