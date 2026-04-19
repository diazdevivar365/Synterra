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
  // Bundle all @synterra/* workspace packages inline — pnpm symlinks don't
  // survive multi-stage Docker builds, so these must not be left as externals.
  noExternal: [/@synterra\/.*/],
  // The Node 22+ runtime resolves these natively via package.json.
  external: [/^node:/],
});
