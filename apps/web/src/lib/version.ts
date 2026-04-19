// Read from the npm lifecycle env var that is populated whenever a script
// (including `next build` and `next dev`) is invoked via pnpm/npm/yarn.
// This resolves to the value in apps/web/package.json at build time, so the
// deployed bundle reports the exact version it was built from without us
// having to import package.json (which would pull it into the client graph).
//
// The fallback keeps the module safe to import from a raw `node` / vitest
// run where the lifecycle env is absent.
export const version = process.env['npm_package_version'] ?? '0.0.0';
