# W1-1 — better-auth Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `better-auth` v1.x into the Synterra control plane so a user can sign up via magic link, receive the email, click the link, and land in a session-persisted dashboard stub.

**Architecture:** `packages/auth` becomes the canonical auth module (replacing its W0-1 stub). It exports a `createBetterAuth(config)` factory consumed by `apps/web`. The Next.js app hosts the better-auth handler at `/api/auth/[...all]`, and `src/middleware.ts` enforces session on protected routes.

**Tech Stack:** better-auth 1.x, `better-auth/adapters/drizzle`, `@synterra/db` (Drizzle + Postgres 16), Resend (email, dev=console), Next.js 16 App Router Server Actions, shadcn-style Tailwind v4 forms.

---

## File Map

| Action   | Path                                                           | Responsibility                                    |
| -------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Modify   | `packages/db/src/schemas/users.ts`                             | `email_verified` BOOLEAN; remove timestamp type   |
| Create   | `packages/db/src/schemas/auth.ts`                              | Drizzle tables for ba_session/ba_account/ba_verification |
| Modify   | `packages/db/src/schema.ts`                                    | Re-export new auth schemas                        |
| Create   | `packages/db/migrations/0013_auth_tables.sql`                  | DB migration: alter users + create ba_* tables    |
| Modify   | `packages/auth/package.json`                                   | Add `drizzle-orm`, `@synterra/db` peer deps       |
| Create   | `packages/auth/src/env.ts`                                     | Zod env schema for auth secrets                   |
| Create   | `packages/auth/src/server.ts`                                  | `createBetterAuth()` factory — server-only        |
| Modify   | `packages/auth/src/index.ts`                                   | Re-export server factory + types; remove stub     |
| Modify   | `packages/auth/src/index.test.ts`                              | Update unit tests for new exports                 |
| Create   | `packages/auth/vitest.integration.config.ts`                   | Vitest config for Testcontainers tests            |
| Create   | `packages/auth/src/server.integration.test.ts`                 | Testcontainers Postgres — magic link round-trip   |
| Modify   | `apps/web/package.json`                                        | Add `@synterra/auth`, `@synterra/db`, `better-auth`, `server-only` |
| Create   | `apps/web/src/lib/auth.ts`                                     | Singleton `auth` instance for this app (server-only) |
| Create   | `apps/web/src/lib/auth-client.ts`                              | `createAuthClient()` for RSC + client components  |
| Create   | `apps/web/src/app/api/auth/[...all]/route.ts`                  | Next.js catch-all handler for better-auth         |
| Create   | `apps/web/src/app/(auth)/layout.tsx`                           | Centered auth layout                              |
| Create   | `apps/web/src/app/(auth)/sign-in/page.tsx`                     | Email input form + magic link send                |
| Create   | `apps/web/src/app/(auth)/sign-in/_actions.ts`                  | Server Action: `sendMagicLink`                    |
| Create   | `apps/web/src/app/(auth)/sign-in/_actions.test.ts`             | Unit test for Server Action                       |
| Create   | `apps/web/src/app/(auth)/verify/page.tsx`                      | Loading state while better-auth processes token   |
| Create   | `apps/web/src/app/dashboard/page.tsx`                          | Minimal protected stub to verify session          |
| Create   | `apps/web/src/middleware.ts`                                    | Session check — redirects unauthenticated users   |
| Create   | `apps/web/src/middleware.test.ts`                              | Unit tests for middleware redirect logic          |
| Modify   | `apps/web/src/app/page.tsx`                                    | Wire "Sign in" link to `/sign-in`                 |
| Modify   | `tests/e2e/smoke.spec.ts`                                      | Add sign-in page smoke test                       |
| Modify   | `tests/e2e/playwright.config.ts`                               | Enable `webServer` block                          |
| Modify   | `.github/workflows/e2e.yml`                                    | Remove `if: false` gate                           |

---

## Task 1: DB migration 0013 — align `users` schema + create `ba_*` tables

`email_verified` is currently a `TIMESTAMPTZ` in users; better-auth 1.x expects a `BOOLEAN`.
No production user data exists yet — this is a safe dev migration.

**Files:**
- Create: `packages/db/migrations/0013_auth_tables.sql`
- Modify: `packages/db/src/schemas/users.ts`
- Create: `packages/db/src/schemas/auth.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Write the migration SQL**

Create `packages/db/migrations/0013_auth_tables.sql`:

```sql
-- W1-1: Align users.email_verified to BOOLEAN (was TIMESTAMPTZ);
--       add better-auth session/account/verification tables (ba_ prefix).

-- 1. Fix email_verified type (no prod data — safe drop/add)
ALTER TABLE users DROP COLUMN email_verified;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. ba_session — better-auth session store
CREATE TABLE ba_session (
  id           TEXT PRIMARY KEY,
  expires_at   TIMESTAMPTZ NOT NULL,
  token        TEXT NOT NULL UNIQUE,
  ip_address   TEXT,
  user_agent   TEXT,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ba_session_user  ON ba_session(user_id);
CREATE INDEX ix_ba_session_token ON ba_session(token);

-- 3. ba_account — OAuth / magic-link account links
CREATE TABLE ba_account (
  id                        TEXT PRIMARY KEY,
  account_id                TEXT NOT NULL,
  provider_id               TEXT NOT NULL,
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token              TEXT,
  refresh_token             TEXT,
  id_token                  TEXT,
  access_token_expires_at   TIMESTAMPTZ,
  refresh_token_expires_at  TIMESTAMPTZ,
  scope                     TEXT,
  password                  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, account_id)
);
CREATE INDEX ix_ba_account_user ON ba_account(user_id);

-- 4. ba_verification — magic link / OTP tokens
CREATE TABLE ba_verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ba_verification_identifier ON ba_verification(identifier);
```

- [ ] **Step 2: Update Drizzle `users` schema**

Replace `packages/db/src/schemas/users.ts`:

```typescript
import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').default('en'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  isSuspended: boolean('is_suspended').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 3: Create `packages/db/src/schemas/auth.ts`**

```typescript
import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const baSessions = pgTable('ba_session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const baAccounts = pgTable(
  'ba_account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.providerId, t.accountId)],
);

export const baVerifications = pgTable('ba_verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BaSession = typeof baSessions.$inferSelect;
export type BaAccount = typeof baAccounts.$inferSelect;
export type BaVerification = typeof baVerifications.$inferSelect;
```

- [ ] **Step 4: Re-export from `packages/db/src/schema.ts`**

Add at the end of `packages/db/src/schema.ts`:

```typescript
export * from './schemas/auth.js';
```

- [ ] **Step 5: Apply migration to dev DB**

```bash
psql "postgresql://synterra_app:<PASSWORD>@192.168.10.50:5432/synterra" \
  -f packages/db/migrations/0013_auth_tables.sql
```

Expected: `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` lines — no errors.

- [ ] **Step 6: Typecheck `@synterra/db`**

```bash
pnpm --filter @synterra/db typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/db/migrations/0013_auth_tables.sql \
        packages/db/src/schemas/users.ts \
        packages/db/src/schemas/auth.ts \
        packages/db/src/schema.ts
git commit -m "feat(db): add better-auth tables + align users.email_verified to boolean"
```

---

## Task 2: Env validation in `packages/auth`

**Files:**
- Create: `packages/auth/src/env.ts`
- Create: `packages/auth/src/env.test.ts`
- Modify: `packages/auth/package.json`

- [ ] **Step 1: Write the failing tests first**

Create `packages/auth/src/env.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

import { parseAuthEnv } from './env.js';

const validEnv = {
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'https://app.forgentic.io',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/synterra',
};

describe('parseAuthEnv', () => {
  it('parses valid env', () => {
    const result = parseAuthEnv(validEnv);
    expect(result.BETTER_AUTH_SECRET).toBe(validEnv.BETTER_AUTH_SECRET);
    expect(result.BETTER_AUTH_URL).toBe(validEnv.BETTER_AUTH_URL);
  });

  it('throws when BETTER_AUTH_SECRET is too short', () => {
    expect(() => parseAuthEnv({ ...validEnv, BETTER_AUTH_SECRET: 'short' })).toThrow(
      'at least 32 characters',
    );
  });

  it('throws when BETTER_AUTH_SECRET is missing', () => {
    const { BETTER_AUTH_SECRET: _, ...rest } = validEnv;
    expect(() => parseAuthEnv(rest)).toThrow('Auth env validation failed');
  });

  it('throws when DATABASE_URL is not a valid URL', () => {
    expect(() => parseAuthEnv({ ...validEnv, DATABASE_URL: 'not-a-url' })).toThrow(
      'valid postgres URL',
    );
  });

  it('allows optional OAuth credentials to be absent', () => {
    const result = parseAuthEnv(validEnv);
    expect(result.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(result.GITHUB_CLIENT_ID).toBeUndefined();
    expect(result.RESEND_API_KEY).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @synterra/auth test
```

Expected: FAIL — `env.js` not found.

- [ ] **Step 3: Create `packages/auth/src/env.ts`**

```typescript
import { z } from 'zod';

const schema = z.object({
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid postgres URL'),
  RESEND_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

export type AuthEnv = z.infer<typeof schema>;

export function parseAuthEnv(raw: Record<string, string | undefined> = process.env): AuthEnv {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Auth env validation failed:\n${lines.join('\n')}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pnpm --filter @synterra/auth test
```

Expected: all 5 env tests PASS.

- [ ] **Step 5: Update `packages/auth/package.json`**

```json
{
  "name": "@synterra/auth",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "clean": "rm -rf dist .turbo coverage"
  },
  "dependencies": {
    "better-auth": "^1.1.0",
    "zod": "catalog:"
  },
  "peerDependencies": {
    "@synterra/db": "workspace:*",
    "drizzle-orm": "catalog:"
  },
  "devDependencies": {
    "@synterra/db": "workspace:*",
    "@synterra/tsconfig": "workspace:*",
    "@testcontainers/postgresql": "catalog:",
    "@types/node": "catalog:",
    "drizzle-orm": "catalog:",
    "eslint": "^9.17.0",
    "testcontainers": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Then:

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/env.ts packages/auth/src/env.test.ts \
        packages/auth/package.json pnpm-lock.yaml
git commit -m "feat(auth): add env validation + update package.json with db peer deps"
```

---

## Task 3: Implement `packages/auth/src/server.ts`

**Files:**
- Create: `packages/auth/src/server.ts`

- [ ] **Step 1: Create `packages/auth/src/server.ts`**

```typescript
import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';

import type { Database } from '@synterra/db';
import { baAccounts, baSessions, baVerifications, users } from '@synterra/db';

import type { AuthEnv } from './env.js';

export interface BetterAuthConfig {
  db: Database;
  env: AuthEnv;
}

export function createBetterAuth({ db, env }: BetterAuthConfig) {
  const isProd =
    env.BETTER_AUTH_URL.startsWith('https://') && !!env.RESEND_API_KEY;

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: users,
        session: baSessions,
        account: baAccounts,
        verification: baVerifications,
      },
    }),

    user: {
      fields: {
        // Map better-auth's 'image' field to our avatar_url column
        image: 'avatarUrl',
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,   // 30 days
      updateAge: 60 * 60 * 24,         // refresh cookie after 24h activity
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,                // cache in-cookie 5 min (cuts DB reads)
      },
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if (!isProd) {
            // Dev / CI: print to stdout — open the link manually
            console.info(`[magic-link] to=${email} url=${url}`);
            return;
          }
          const { Resend } = await import('resend');
          const resend = new Resend(env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Forgentic <no-reply@forgentic.io>',
            to: email,
            subject: 'Your Forgentic sign-in link',
            html: `<p>Sign in to Forgentic:</p><p><a href="${url}">${url}</a></p><p>Expires in 10 minutes.</p>`,
          });
        },
      }),
    ],

    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
        : {}),
    },

    trustedOrigins: [env.BETTER_AUTH_URL],
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
```

- [ ] **Step 2: Check if `server-only` is in the catalog. If not, add it.**

Check `pnpm-workspace.yaml` catalog section. If `server-only` is absent:

```bash
pnpm --filter @synterra/auth add server-only
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @synterra/auth typecheck
```

Expected: no errors. If `better-auth/adapters/drizzle` or `better-auth/plugins` types fail, ensure `better-auth ^1.1.0` is installed (`pnpm install`).

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/server.ts pnpm-lock.yaml
git commit -m "feat(auth): implement createBetterAuth factory — magic-link + OAuth + Drizzle adapter"
```

---

## Task 4: Replace stub in `packages/auth/src/index.ts`

**Files:**
- Modify: `packages/auth/src/index.ts`
- Modify: `packages/auth/src/index.test.ts`

- [ ] **Step 1: Rewrite `packages/auth/src/index.ts`**

```typescript
export { createBetterAuth } from './server.js';
export type { BetterAuthConfig, BetterAuthInstance } from './server.js';
export { parseAuthEnv } from './env.js';
export type { AuthEnv } from './env.js';
```

- [ ] **Step 2: Update `packages/auth/src/index.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';

import { parseAuthEnv } from './index.js';

describe('@synterra/auth public exports', () => {
  it('exports parseAuthEnv', () => {
    expect(typeof parseAuthEnv).toBe('function');
  });

  it('parseAuthEnv throws on empty env', () => {
    expect(() => parseAuthEnv({})).toThrow('Auth env validation failed');
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (previous 39 + new env/index tests).

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/index.ts packages/auth/src/index.test.ts
git commit -m "feat(auth): replace stub index with real exports; update unit tests"
```

---

## Task 5: Wire better-auth into `apps/web`

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/auth-client.ts`
- Create: `apps/web/src/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Add deps to `apps/web/package.json`**

In the `dependencies` block add:

```json
"@synterra/auth": "workspace:*",
"@synterra/db": "workspace:*",
"better-auth": "catalog:",
"drizzle-orm": "catalog:",
"postgres": "catalog:",
"server-only": "^0.0.1"
```

Then:

```bash
pnpm install
```

- [ ] **Step 2: Create `apps/web/src/lib/auth.ts`**

```typescript
import 'server-only';

import { createDb } from '@synterra/db';
import { createBetterAuth, parseAuthEnv } from '@synterra/auth';

const env = parseAuthEnv(process.env);
const db = createDb(env.DATABASE_URL);

export const auth = createBetterAuth({ db, env });
```

- [ ] **Step 3: Create `apps/web/src/lib/auth-client.ts`**

```typescript
import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 4: Create `apps/web/src/app/api/auth/[...all]/route.ts`**

```typescript
import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth';

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json \
        apps/web/src/lib/auth.ts \
        apps/web/src/lib/auth-client.ts \
        "apps/web/src/app/api/auth/[...all]/route.ts" \
        pnpm-lock.yaml
git commit -m "feat(web): wire better-auth singleton + API catch-all handler"
```

---

## Task 6: Sign-in page + magic link Server Action

**Files:**
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/sign-in/_actions.ts`
- Create: `apps/web/src/app/(auth)/sign-in/_actions.test.ts`
- Create: `apps/web/src/app/(auth)/sign-in/page.tsx`

- [ ] **Step 1: Create the auth layout**

Create `apps/web/src/app/(auth)/layout.tsx`:

```typescript
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write the Server Action test first**

Create `apps/web/src/app/(auth)/sign-in/_actions.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signInMagicLink: vi.fn().mockResolvedValue({ status: true }),
    },
  },
}));

// next/headers and next/navigation need stubs in Vitest
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('sendMagicLink', () => {
  it('calls auth.api.signInMagicLink with email from FormData', async () => {
    const { sendMagicLink } = await import('./_actions.js');
    const { auth } = await import('@/lib/auth');

    const formData = new FormData();
    formData.set('email', 'test@forgentic.io');

    await sendMagicLink(formData);

    expect(auth.api.signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: 'test@forgentic.io' }),
      }),
    );
  });

  it('throws on invalid email', async () => {
    const { sendMagicLink } = await import('./_actions.js');
    const formData = new FormData();
    formData.set('email', 'not-an-email');

    await expect(sendMagicLink(formData)).rejects.toThrow('valid email');
  });
});
```

- [ ] **Step 3: Run tests — confirm fail**

```bash
pnpm --filter @synterra/web test
```

Expected: FAIL — `_actions.js` not found.

- [ ] **Step 4: Create `_actions.ts`**

Create `apps/web/src/app/(auth)/sign-in/_actions.ts`:

```typescript
'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  await auth.api.signInMagicLink({
    body: { email, callbackURL: '/dashboard' },
    headers: await headers(),
  });

  redirect('/sign-in?sent=1');
}
```

- [ ] **Step 5: Run tests — confirm pass**

```bash
pnpm --filter @synterra/web test
```

Expected: PASS.

- [ ] **Step 6: Create the sign-in page**

Create `apps/web/src/app/(auth)/sign-in/page.tsx`:

```typescript
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { sendMagicLink } from './_actions';

interface Props {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

  const { sent, error } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-fg text-2xl font-semibold tracking-tight">Sign in to Forgentic</h1>
        <p className="text-muted-fg text-sm">
          Enter your email and we&apos;ll send you a magic link.
        </p>
      </div>

      {sent && (
        <div className="bg-surface border-border rounded-lg border p-4 text-center text-sm">
          <p className="text-fg font-medium">Check your inbox</p>
          <p className="text-muted-fg mt-1">We sent a sign-in link to your email.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error === 'expired'
            ? 'This link has expired. Request a new one.'
            : 'Something went wrong. Please try again.'}
        </div>
      )}

      {!sent && (
        <form action={sendMagicLink} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-fg block text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="border-border bg-surface text-fg placeholder:text-muted-fg focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            />
          </div>
          <button
            type="submit"
            className="bg-brand-500 hover:bg-brand-400 text-fg w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Send magic link →
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(auth)/"
git commit -m "feat(web): add sign-in page with magic link Server Action + tests"
```

---

## Task 7: Verify page + protected dashboard stub

**Files:**
- Create: `apps/web/src/app/(auth)/verify/page.tsx`
- Create: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create verify page**

Create `apps/web/src/app/(auth)/verify/page.tsx`:

```typescript
export default function VerifyPage() {
  return (
    <div className="space-y-4 text-center">
      <div className="border-brand-500 mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      <p className="text-muted-fg text-sm">Verifying your sign-in link…</p>
    </div>
  );
}
```

- [ ] **Step 2: Create protected dashboard stub**

Create `apps/web/src/app/dashboard/page.tsx`:

```typescript
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <h1 className="text-fg text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-fg text-sm">
        Signed in as{' '}
        <span className="text-fg font-medium">{session.user.email}</span>
      </p>
      <form
        action={async () => {
          'use server';
          const { auth: a } = await import('@/lib/auth');
          const { headers: h } = await import('next/headers');
          await a.api.signOut({ headers: await h() });
          redirect('/sign-in');
        }}
      >
        <button
          type="submit"
          className="border-border bg-surface text-muted-fg hover:text-fg rounded-lg border px-4 py-2 text-sm transition-colors"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @synterra/web typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(auth)/verify/" apps/web/src/app/dashboard/
git commit -m "feat(web): add verify page + protected dashboard stub with sign-out"
```

---

## Task 8: Middleware — session enforcement

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/middleware.test.ts`

- [ ] **Step 1: Write tests first**

Create `apps/web/src/middleware.test.ts`:

```typescript
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./lib/auth', () => ({
  auth: {
    api: { getSession: vi.fn() },
  },
}));

describe('middleware', () => {
  it('redirects unauthenticated /dashboard to /sign-in', async () => {
    const { auth } = await import('./lib/auth');
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

    const { middleware } = await import('./middleware.js');
    const req = new NextRequest('http://localhost:3000/dashboard');
    const res = await middleware(req);

    expect(res?.headers.get('location')).toContain('/sign-in');
  });

  it('passes authenticated requests through', async () => {
    const { auth } = await import('./lib/auth');
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: { id: 'u1', email: 'test@forgentic.io' },
      session: { id: 's1', expiresAt: new Date(Date.now() + 1e6) },
    } as never);

    const { middleware } = await import('./middleware.js');
    const req = new NextRequest('http://localhost:3000/dashboard');
    const res = await middleware(req);

    expect(res?.headers.get('location')).toBeNull();
  });

  it('skips non-protected paths', async () => {
    const { middleware } = await import('./middleware.js');
    const req = new NextRequest('http://localhost:3000/');
    const res = await middleware(req);

    // Public path — NextResponse.next(), no redirect
    expect(res?.headers.get('location')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
pnpm --filter @synterra/web test -- middleware.test
```

Expected: FAIL — `middleware.js` not found.

- [ ] **Step 3: Create `apps/web/src/middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/lib/auth';

const PROTECTED_PREFIXES = ['/dashboard'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
pnpm --filter @synterra/web test -- middleware.test
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/middleware.test.ts
git commit -m "feat(web): add session-enforcement middleware; protect /dashboard"
```

---

## Task 9: Wire landing page + enable e2e

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `tests/e2e/playwright.config.ts`
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Update "Sign in" link in landing page**

In `apps/web/src/app/page.tsx`, find the `Sign in` anchor and change `href="#"` to `href="/sign-in"`. Remove the placeholder comment.

Old:
```typescript
            <a
              href="#"
              className="border-border bg-surface text-fg hover:border-brand-500 focus-visible:border-brand-500 rounded-md border px-3 py-1.5 transition-colors focus-visible:outline-none"
              /* Routed in a later milestone once auth lands. */
            >
              Sign in
            </a>
```

New:
```typescript
            <a
              href="/sign-in"
              className="border-border bg-surface text-fg hover:border-brand-500 focus-visible:border-brand-500 rounded-md border px-3 py-1.5 transition-colors focus-visible:outline-none"
            >
              Sign in
            </a>
```

- [ ] **Step 2: Add sign-in smoke test**

In `tests/e2e/smoke.spec.ts`, add after the existing tests:

```typescript
test('sign-in page renders email form', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel('Work email')).toBeVisible();
  await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
});
```

- [ ] **Step 3: Enable webServer in playwright config**

In `tests/e2e/playwright.config.ts`, uncomment/enable the `webServer` block:

```typescript
  webServer: {
    command: 'pnpm --filter @synterra/web dev',
    port: 3000,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'] ?? 'e2e-test-secret-min-32-chars!!',
      BETTER_AUTH_URL: 'http://localhost:3000',
      DATABASE_URL: process.env['DATABASE_URL'] ?? '',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
```

- [ ] **Step 4: Remove `if: false` gate in e2e workflow**

In `.github/workflows/e2e.yml`, find `if: false` and remove that line (or change to `if: true`).

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx \
        tests/e2e/smoke.spec.ts \
        tests/e2e/playwright.config.ts \
        .github/workflows/e2e.yml
git commit -m "feat(web): wire sign-in link; enable e2e webServer + smoke auth check"
```

---

## Task 10: Integration test — Testcontainers magic-link round-trip

**Files:**
- Create: `packages/auth/vitest.integration.config.ts`
- Create: `packages/auth/src/server.integration.test.ts`

- [ ] **Step 1: Create vitest integration config**

Create `packages/auth/vitest.integration.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
  },
});
```

- [ ] **Step 2: Write integration test**

Create `packages/auth/src/server.integration.test.ts`:

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBetterAuth } from './server.js';
import type { BetterAuthInstance } from './server.js';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
let authInstance: BetterAuthInstance;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  const sql = postgres(url, { max: 1 });

  // Bootstrap schema inline (mirrors 0001_users.sql + 0013_auth_tables.sql)
  await sql.unsafe(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      name TEXT, avatar_url TEXT, locale TEXT DEFAULT 'en',
      last_login_at TIMESTAMPTZ, is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE ba_session (
      id TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL UNIQUE, ip_address TEXT, user_agent TEXT,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE ba_account (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT, refresh_token TEXT, id_token TEXT,
      access_token_expires_at TIMESTAMPTZ, refresh_token_expires_at TIMESTAMPTZ,
      scope TEXT, password TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider_id, account_id)
    );
    CREATE TABLE ba_verification (
      id TEXT PRIMARY KEY, identifier TEXT NOT NULL,
      value TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { createDb } = await import('@synterra/db');
  const db = createDb(url);

  authInstance = createBetterAuth({
    db,
    env: {
      BETTER_AUTH_SECRET: 'integration-test-secret-min-32-chars-ok',
      BETTER_AUTH_URL: 'http://localhost:3000',
      DATABASE_URL: url,
    },
  });
}, 60_000);

afterAll(async () => {
  await container?.stop();
});

describe('createBetterAuth', () => {
  it('returns an instance with a handler function', () => {
    expect(typeof authInstance.handler).toBe('function');
  });

  it('magic-link sign-in request returns 200 { status: true }', async () => {
    const req = new Request(
      'http://localhost:3000/api/auth/sign-in/magic-link',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'integration@forgentic.io',
          callbackURL: '/dashboard',
        }),
      },
    );

    const res = await authInstance.handler(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status?: boolean };
    expect(body.status).toBe(true);
  });
});
```

- [ ] **Step 3: Run integration test**

```bash
pnpm --filter @synterra/auth test:integration
```

Expected: PASS (container starts in ~10s, schema bootstraps, magic-link returns 200).

- [ ] **Step 4: Commit**

```bash
git add packages/auth/vitest.integration.config.ts \
        packages/auth/src/server.integration.test.ts
git commit -m "test(auth): Testcontainers integration test for magic-link round-trip"
```

---

## Task 11: Mark W1-1 complete in `tasks/todo.md`

- [ ] **Step 1: Append W1-1 section to `Synterra/tasks/todo.md`**

```markdown
---

# W1-1 — better-auth Integration ✅ COMPLETE

**Workstream:** PLAN_05_Execution_and_Appendix.md → W1-1
**Definition of done:** Full sign-up via magic link works on dev; session persists across restarts.

- [x] DB migration 0013: users.email_verified BOOLEAN + ba_session/ba_account/ba_verification
- [x] packages/auth env validation (zod)
- [x] packages/auth createBetterAuth factory (magic-link + Google/GitHub OAuth)
- [x] packages/auth index.ts — real exports replacing stub
- [x] apps/web — better-auth singleton + /api/auth/[...all] handler
- [x] apps/web — (auth) layout + sign-in page + Server Action + tests
- [x] apps/web — /dashboard protected stub
- [x] apps/web — middleware session enforcement + tests
- [x] e2e smoke — sign-in page + webServer block enabled
- [x] Integration test — Testcontainers magic-link round-trip
```

- [ ] **Step 2: Commit**

```bash
git add Synterra/tasks/todo.md
git commit -m "docs(tasks): mark W1-1 complete"
```

---

## Acceptance Verification

```bash
# 1. All unit tests
pnpm test

# 2. Typechecks
pnpm typecheck

# 3. Lint
pnpm lint

# 4. Integration test (requires Docker)
pnpm --filter @synterra/auth test:integration

# 5. Manual end-to-end (golden path)
#    Start dev server with env:
#      BETTER_AUTH_SECRET=<32-char-string>
#      BETTER_AUTH_URL=http://localhost:3000
#      DATABASE_URL=postgresql://synterra_app:<pass>@192.168.10.50:5432/synterra
#      NEXT_PUBLIC_APP_URL=http://localhost:3000
#
#    a. Open http://localhost:3000/sign-in
#    b. Enter your email → click "Send magic link →"
#    c. Copy the URL printed to terminal (dev mode)
#    d. Paste in browser → lands on /dashboard with your email
#    e. Restart dev server → refresh /dashboard → still authenticated ✅
```

---

## Deferred to W1-2+

| Feature | Workstream |
|---|---|
| `synterra_workspace_jwt` cookie + workspace switching | W1-2 |
| Workspace switcher UI (Cmd+K + dropdown) | W1-2 |
| WorkOS SAML/SCIM adapter | W1-3 |
| Passkey (WebAuthn) — needs HTTPS + prod domain | W1-4 |
| Google/GitHub OAuth — wire `GOOGLE_CLIENT_ID` in Infisical | Deploy-time (code ready) |
| Settings → Security (active sessions list) | W2-1 |
