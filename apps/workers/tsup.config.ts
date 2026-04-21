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
  noExternal: [/@synterra\/.*/],
  // @opentelemetry/* packages are CJS and use dynamic require() internally;
  // bundling them into ESM breaks at runtime. Keep them as node_modules externals.
  // react + @react-email/* live in packages/emails/node_modules (isolated linker);
  // the Dockerfile copies that tree into the runner image so they resolve at runtime.
  external: [/^node:/, /^@opentelemetry\//, /^prom-client/, /^react/, /^@react-email\//],
});
