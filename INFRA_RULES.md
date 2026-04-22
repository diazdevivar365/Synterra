# Forgentic / Synterra — Infrastructure & Execution Rules

> **CRITICAL AGENT MEMORY**: Do NOT ignore these rules under any circumstances. Failure to follow these will cause production or demonstration outages.

## 1. Infrastructure Topology (SaaS vs Data Plane)

- **Forgentic SaaS (Synterra)** has its **OWN** isolated database and cache.
- **DATABASE**: `forgentic-db.lan` (RDS Postgres Multi-AZ)
- **CACHE**: `forgentic-cache.lan` (ElastiCache Redis Multi-AZ)
- **NEVER** confuse the Forgentic database with the Aquila Data Plane database (`aquila-pg` / `192.168.10.45`). They are completely separate. `DATABASE_URL` in Synterra must ALWAYS point to `forgentic-db.lan`.

## 2. Next.js App Router Pitfalls

- **`server-only` leakage**: Files like `lib/brands.ts` or `lib/db.ts` rely on `server-only` and node-native modules (`fs`, `net`, `tls` via Postgres/Drizzle).
- **Rule**: NEVER import helper functions, types, or anything from a `server-only` file directly into a Client Component (`'use client'`). This will cause the bundler to try to include Node modules in the browser, crashing the build (`Module not found: Can't resolve 'fs'`).
- **Fix**: Move shared types (`BrandDna`, `DnaTwin`) and pure helper functions (`brandNameFromId`) to safe, non-server-bound files (e.g., `brand-utils.ts` or `types.ts`), or define them locally in the client component.

## 3. Middleware & Public Assets

- The `middleware.ts` automatically redirects all unauthenticated traffic to `/sign-in`.
- **Rule**: Any static asset, font, or public API must be explicitly added to `PUBLIC_PREFIXES` in `middleware.ts`.
- **Example**: If you download a custom font to `/public/fonts`, you MUST add `'/fonts/'` to `PUBLIC_PREFIXES`, otherwise the font will be blocked by a 307 redirect to the login page, breaking the UI aesthetics.

## 4. Secrets Management (Infisical)

- **CRITICAL**: We do **NOT** use `.env` files in any of our environments or servers (with the sole exception of a single isolated local environment for specific tests).
- **Rule**: All secrets, environment variables, and configuration flags are centrally managed and injected via **Infisical** (hosted in the `FG-Infisical` LXC container).
- **Action**: Do not instruct the user to "create an `.env` file on the server" or "SSH and export variables". All secret changes must be directed to Infisical.
