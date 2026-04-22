import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  bundle: true,
  minify: false,
  sourcemap: true,
  splitting: false,
  clean: true,
  dts: false,
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  // Bundle @synterra/* workspace TS source inline — pnpm symlinks don't
  // survive multi-stage Docker builds, so these must not be left as externals.
  // react + @react-email/* must also be bundled: NODE_PATH is ignored by Node.js ESM,
  // so leaving them external causes ERR_MODULE_NOT_FOUND at runtime.
  noExternal: [/@synterra\/.*/, /^react/, /^react-dom/, /^@react-email\//],
  // @opentelemetry/* packages are CJS and use dynamic require() internally;
  // bundling them into ESM breaks at runtime. Keep them as node_modules externals.
  external: [/^node:/, /^@opentelemetry\//, /^prom-client/],
});
