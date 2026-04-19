// Forgentic web — Next.js 16 configuration.
//
// Conservative, production-grade defaults. Tuning here is intentionally
// minimal: Turbopack is the default dev bundler, and typed routes are
// enabled to catch dead links at compile time.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output bundles only the runtime needed to serve the app.
  // Required for Docker — copies /standalone + /static into the image.
  output: 'standalone',

  experimental: {
    // Type-safe <Link href="..."> — broken routes fail the build.
    typedRoutes: true,
  },

  // Workspace packages that will ship untranspiled ESM. Next must run them
  // through SWC so that React Server Components and TypeScript features
  // keep working when we import across the monorepo boundary.
  //
  // NOTE: @synterra/ui and @synterra/shared are placeholders — they do not
  // exist yet in packages/. They will be scaffolded in a follow-up change;
  // keeping them here now prevents config churn when they land.
  transpilePackages: ['@synterra/ui', '@synterra/shared', '@synterra/telemetry'],

  logging: {
    fetches: {
      // Full URLs in dev make it obvious what the RSC tree is actually
      // requesting. Harmless in prod because dev-only logging is scoped.
      fullUrl: true,
    },
  },
};

export default nextConfig;
