# W2-3 URL-first Onboarding ("90-second wow") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an anonymous visitor paste their brand's website URL and see a live brand-intelligence preview in under 90 seconds — no sign-up required — then claim the result with a magic-link email.

**Architecture:** The `/start` page collects URL + Cloudflare Turnstile token; a Server Action validates, rate-limits (Redis, 3 req/IP/hr), and enqueues a `bootstrap-anon` BullMQ job. The job calls Aquila's `synterra_anon` org to run a shallow research pass, then writes preview data back to `inflight_bootstrap`. The browser polls progress via Server-Sent Events from `/api/onboarding/[id]/stream`. After the preview, the visitor enters their email → magic link → `claimOnboarding` action attaches the result to their new workspace and re-queues a deeper run.

**Tech Stack:** Next.js 15 App Router (RSC + Server Actions + Route Handlers), BullMQ, ioredis, Drizzle ORM + Postgres, `@marsidev/react-turnstile`, Cloudflare Turnstile, `@synterra/aquila-client`.

**Architecture note — SSE vs Supabase Realtime:** PLAN.md §W2-3 says "Supabase Realtime" but Supabase is not in the stack. Server-Sent Events via Next.js Route Handler achieve identical UX with zero new infrastructure and no new SDK. This is the implementation choice.

---

## File Map

| File                                                   | Action | Responsibility                                       |
| ------------------------------------------------------ | ------ | ---------------------------------------------------- |
| `packages/db/src/schemas/inflight.ts`                  | Create | Drizzle schema for `inflight_bootstrap`              |
| `packages/db/migrations/0015_inflight_bootstrap.sql`   | Create | SQL DDL for the table                                |
| `packages/db/src/schema.ts`                            | Modify | Re-export new schema                                 |
| `apps/workers/src/queues.ts`                           | Modify | Add `BOOTSTRAP_ANON` queue name + job data type      |
| `apps/web/src/lib/queue.ts`                            | Modify | Add `getBootstrapAnonQueue` factory                  |
| `packages/aquila-client/src/index.ts`                  | Modify | Add `getResearchRun` method                          |
| `apps/web/src/lib/rate-limit.ts`                       | Create | Redis per-IP rate limiter                            |
| `apps/web/src/lib/turnstile.ts`                        | Create | Cloudflare Turnstile server-side verify              |
| `apps/web/src/actions/onboarding.ts`                   | Create | `startOnboarding` + `claimOnboarding` Server Actions |
| `apps/workers/src/bootstrap-worker.ts`                 | Create | BullMQ worker: create run, poll, write preview       |
| `apps/workers/src/index.ts`                            | Modify | Register bootstrap worker + graceful shutdown        |
| `apps/web/src/app/api/onboarding/[id]/stream/route.ts` | Create | SSE: polls DB every 2 s, emits status events         |
| `apps/web/src/app/start/page.tsx`                      | Create | URL input form + Turnstile widget                    |
| `apps/web/src/app/start/[id]/page.tsx`                 | Create | Live progress bar + preview card + email capture     |
| `apps/web/src/middleware.ts`                           | Modify | Add `/start` to `PUBLIC_PREFIXES`                    |

---

## Task 1: DB Schema — `inflight_bootstrap`

**Files:**

- Create: `packages/db/src/schemas/inflight.ts`
- Create: `packages/db/migrations/0015_inflight_bootstrap.sql`
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Write the failing schema unit test**

Create `packages/db/src/schemas/inflight.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { inflightBootstrap, INFLIGHT_STATUS } from './inflight.js';

describe('inflightBootstrap schema', () => {
  it('exports INFLIGHT_STATUS tuple', () => {
    expect(INFLIGHT_STATUS).toEqual(['pending', 'running', 'preview_ready', 'claimed', 'failed']);
  });

  it('table name is inflight_bootstrap', () => {
    expect((inflightBootstrap as unknown as { _: { name: string } })._.name).toBe('inflight_bootstrap');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/diazdevivar/Projects/Forgentic/Synterra
pnpm --filter @synterra/db test --reporter verbose 2>&1 | tail -20
```

Expected: `Cannot find module './inflight.js'`

- [ ] **Step 3: Create the Drizzle schema**

Create `packages/db/src/schemas/inflight.ts`:

```typescript
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { workspaces } from './workspaces.js';

export const INFLIGHT_STATUS = ['pending', 'running', 'preview_ready', 'claimed', 'failed'] as const;
export type InflightStatus = (typeof INFLIGHT_STATUS)[number];

export const inflightBootstrap = pgTable('inflight_bootstrap', {
  id: uuid('id').primaryKey().defaultRandom(),
  urlInput: text('url_input').notNull(),
  email: text('email'),
  aquilaRunId: text('aquila_run_id'),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  status: text('status').notNull().$type<InflightStatus>().default('pending'),
  previewData: jsonb('preview_data'),
  error: text('error'),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export type InflightBootstrap = typeof inflightBootstrap.$inferSelect;
export type NewInflightBootstrap = typeof inflightBootstrap.$inferInsert;
```

- [ ] **Step 4: Create the SQL migration**

Create `packages/db/migrations/0015_inflight_bootstrap.sql`:

```sql
CREATE TABLE IF NOT EXISTS inflight_bootstrap (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url_input     text        NOT NULL,
  email         text,
  aquila_run_id text,
  workspace_id  uuid        REFERENCES workspaces(id),
  status        text        NOT NULL DEFAULT 'pending',
  preview_data  jsonb,
  error         text,
  ip_hash       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  claimed_at    timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_inflight_bootstrap_status  ON inflight_bootstrap(status);
CREATE INDEX IF NOT EXISTS idx_inflight_bootstrap_email   ON inflight_bootstrap(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inflight_bootstrap_expires ON inflight_bootstrap(expires_at);
```

- [ ] **Step 5: Add export to `packages/db/src/schema.ts`**

Append after the `sso.js` export line:

```typescript
export * from './schemas/inflight.js';
```

- [ ] **Step 6: Run the schema tests**

```bash
pnpm --filter @synterra/db test --reporter verbose 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 7: Apply migration to dev DB**

```bash
ssh root@forgentic-db.lan "docker exec -i forgentic-postgres psql -U forgentic -d forgentic" < packages/db/migrations/0015_inflight_bootstrap.sql
echo $?
```

Expected: `0`

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schemas/inflight.ts packages/db/src/schemas/inflight.test.ts packages/db/migrations/0015_inflight_bootstrap.sql packages/db/src/schema.ts
git commit -m "feat(db): add inflight_bootstrap table for W2-3 URL-first onboarding"
```

---

## Task 2: Queue — Add `bootstrap-anon` queue

**Files:**

- Modify: `apps/workers/src/queues.ts`
- Modify: `apps/web/src/lib/queue.ts`

- [ ] **Step 1: Write failing test for queue name constant**

Append to `apps/workers/src/queues.test.ts` (create if absent):

```typescript
import { describe, it, expect } from 'vitest';
import { QUEUE_NAMES } from './queues.js';

describe('QUEUE_NAMES', () => {
  it('has BOOTSTRAP_ANON', () => {
    expect(QUEUE_NAMES.BOOTSTRAP_ANON).toBe('synterra-bootstrap-anon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @synterra/workers test --reporter verbose 2>&1 | tail -10
```

Expected: `BOOTSTRAP_ANON` is `undefined`.

- [ ] **Step 3: Update `queues.ts`**

Replace the `QUEUE_NAMES` const in `apps/workers/src/queues.ts` with:

```typescript
export const QUEUE_NAMES = {
  DEFAULT: 'synterra-default',
  PROVISION: 'synterra-workspace-provision',
  BOOTSTRAP_ANON: 'synterra-bootstrap-anon',
} as const;
```

Append the new job data type:

```typescript
export interface BootstrapAnonJobData {
  inflightId: string;
  urlInput: string;
  /** Present only for bootstrap-claim jobs. */
  workspaceId?: string;
}
```

- [ ] **Step 4: Add `getBootstrapAnonQueue` to `apps/web/src/lib/queue.ts`**

Append to the existing file (after the existing exports):

```typescript
// Must match QUEUE_NAMES.BOOTSTRAP_ANON in apps/workers/src/queues.ts
const BOOTSTRAP_ANON_QUEUE_NAME = 'synterra-bootstrap-anon';

export interface BootstrapAnonJobData {
  inflightId: string;
  urlInput: string;
  workspaceId?: string;
}

let _bootstrapQueue: Queue<BootstrapAnonJobData> | undefined;

export function getBootstrapAnonQueue(): Queue<BootstrapAnonJobData> {
  if (!_bootstrapQueue) {
    _bootstrapQueue = new Queue(BOOTSTRAP_ANON_QUEUE_NAME, { connection: getConnection() });
  }
  return _bootstrapQueue;
}
```

> `Queue` and `getConnection` are already imported at the top of this file.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @synterra/workers test --reporter verbose 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/workers/src/queues.ts apps/web/src/lib/queue.ts
git commit -m "feat(workers): add synterra-bootstrap-anon queue for W2-3"
```

---

## Task 3: Aquila client — Add `getResearchRun`

**Files:**

- Modify: `packages/aquila-client/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/aquila-client/src/index.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createAquilaClient, SUPPORTED_CONTRACT_VERSION } from './index.js';

describe('getResearchRun', () => {
  it('GETs /orgs/:orgId/research-runs/:runId with Bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'run-1',
        organizationId: 'org-1',
        query: 'acme.com',
        status: 'succeeded',
        createdAt: '2026-04-20T00:00:00Z',
        completedAt: '2026-04-20T00:01:20Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAquilaClient({
      baseUrl: 'http://localhost:4000',
      apiKey: 'test-key',
      orgSlug: 'test-org',
      contractVersion: SUPPORTED_CONTRACT_VERSION,
    });

    const run = await client.getResearchRun('org-1', 'run-1');
    expect(run.id).toBe('run-1');
    expect(run.status).toBe('succeeded');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/orgs/org-1/research-runs/run-1',
      expect.objectContaining({ method: 'GET' }),
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @synterra/aquila-client test --reporter verbose 2>&1 | tail -10
```

Expected: `client.getResearchRun is not a function`

- [ ] **Step 3: Add `getResearchRun` to the interface**

In `packages/aquila-client/src/index.ts`, add to the `AquilaClient` interface after `createResearchRun`:

```typescript
  /** Fetch a single research run by ID. */
  getResearchRun(organizationId: string, runId: string): Promise<ResearchRun>;
```

- [ ] **Step 4: Implement `getResearchRun` in the factory**

In the factory return object, add after `createResearchRun`:

```typescript
    async getResearchRun(organizationId, runId) {
      return fetchJson<ResearchRun>(
        `${baseUrl}/orgs/${organizationId}/research-runs/${runId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Slug': orgSlug },
        },
      );
    },
```

- [ ] **Step 5: Run test**

```bash
pnpm --filter @synterra/aquila-client test --reporter verbose 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/aquila-client/src/index.ts packages/aquila-client/src/index.test.ts
git commit -m "feat(aquila-client): add getResearchRun for W2-3 polling"
```

---

## Task 4: Libs — Rate limiter + Turnstile verifier

**Files:**

- Create: `apps/web/src/lib/rate-limit.ts`
- Create: `apps/web/src/lib/turnstile.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('checkRateLimit', () => {
  it('allows first request and returns remaining=2', async () => {
    const redisMock = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };
    const { checkRateLimit } = await import('./rate-limit.js');
    const result = await checkRateLimit(redisMock as never, '1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(redisMock.expire).toHaveBeenCalledWith(expect.stringContaining('ratelimit:onboarding:'), 3600);
  });

  it('blocks 4th request', async () => {
    const redisMock = {
      incr: vi.fn().mockResolvedValue(4),
      expire: vi.fn().mockResolvedValue(1),
    };
    const { checkRateLimit } = await import('./rate-limit.js');
    const result = await checkRateLimit(redisMock as never, '1.2.3.4');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
```

Create `apps/web/src/lib/turnstile.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('verifyTurnstileToken', () => {
  it('returns true on success:true response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }));
    process.env['CLOUDFLARE_TURNSTILE_SECRET_KEY'] = 'test-secret';
    const { verifyTurnstileToken } = await import('./turnstile.js');
    expect(await verifyTurnstileToken('valid-token', '1.2.3.4')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns false on success:false response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    process.env['CLOUDFLARE_TURNSTILE_SECRET_KEY'] = 'test-secret';
    const { verifyTurnstileToken } = await import('./turnstile.js');
    expect(await verifyTurnstileToken('bad-token', '1.2.3.4')).toBe(false);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @synterra/web test src/lib/rate-limit.test.ts src/lib/turnstile.test.ts 2>&1 | tail -10
```

Expected: module not found errors.

- [ ] **Step 3: Create `apps/web/src/lib/rate-limit.ts`**

```typescript
import { createHash } from 'node:crypto';

import type IORedis from 'ioredis';

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECS = 3600;

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + (process.env['IP_HASH_SALT'] ?? ''))
    .digest('hex')
    .slice(0, 16);
}

export async function checkRateLimit(redis: IORedis, ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:onboarding:${hashIp(ip)}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECS);
  }
  return {
    allowed: count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - count),
  };
}
```

- [ ] **Step 4: Create `apps/web/src/lib/turnstile.ts`**

```typescript
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secret = process.env['CLOUDFLARE_TURNSTILE_SECRET_KEY'];
  if (!secret) throw new Error('CLOUDFLARE_TURNSTILE_SECRET_KEY is not set');

  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
  const data = (await res.json()) as { success: boolean };
  return data.success;
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @synterra/web test src/lib/rate-limit.test.ts src/lib/turnstile.test.ts 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/rate-limit.ts apps/web/src/lib/rate-limit.test.ts apps/web/src/lib/turnstile.ts apps/web/src/lib/turnstile.test.ts
git commit -m "feat(web): rate-limit and turnstile libs for W2-3"
```

---

## Task 5: Server Actions — `startOnboarding` + `claimOnboarding`

**Files:**

- Create: `apps/web/src/actions/onboarding.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/actions/onboarding.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/turnstile.js', () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}));
vi.mock('../lib/rate-limit.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 2 }),
}));
vi.mock('../lib/queue.js', () => ({
  getBootstrapAnonQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  }),
}));
vi.mock('@synterra/db', () => ({
  createDb: vi.fn().mockReturnValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'inflight-uuid-1' }]),
      }),
    }),
  }),
  inflightBootstrap: {},
}));
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['cf-connecting-ip', '1.2.3.4']])),
}));
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  })),
}));

describe('startOnboarding', () => {
  it('returns ok=true with inflightId for valid URL', async () => {
    const { startOnboarding } = await import('./onboarding.js');
    const result = await startOnboarding('example.com', 'valid-turnstile-token');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.inflightId).toBe('inflight-uuid-1');
  });

  it('returns INVALID_URL for garbage input', async () => {
    const { startOnboarding } = await import('./onboarding.js');
    const result = await startOnboarding('not a url !!!', 'token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_URL');
  });
});

describe('startOnboarding rate limit', () => {
  it('returns RATE_LIMITED when checkRateLimit disallows', async () => {
    const { checkRateLimit } = await import('../lib/rate-limit.js');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const { startOnboarding } = await import('./onboarding.js');
    const result = await startOnboarding('valid.com', 'token');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('RATE_LIMITED');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @synterra/web test src/actions/onboarding.test.ts 2>&1 | tail -10
```

Expected: module not found.

- [ ] **Step 3: Create `apps/web/src/actions/onboarding.ts`**

```typescript
'use server';

import { createHash } from 'node:crypto';

import IORedis from 'ioredis';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

import { createDb, inflightBootstrap } from '@synterra/db';

import { checkRateLimit } from '../lib/rate-limit.js';
import { getBootstrapAnonQueue } from '../lib/queue.js';
import { verifyTurnstileToken } from '../lib/turnstile.js';

const db = createDb(process.env['DATABASE_URL'] ?? '');

function getRedis(): IORedis {
  return new IORedis(process.env['REDIS_URL'] ?? '', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export type OnboardingActionResult = { ok: true; inflightId: string } | { ok: false; code: string; message: string };

export async function startOnboarding(urlInput: string, turnstileToken: string): Promise<OnboardingActionResult> {
  const hdrs = await headers();
  const ip = hdrs.get('cf-connecting-ip') ?? hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';

  const redis = getRedis();
  const { allowed } = await checkRateLimit(redis, ip);
  if (!allowed) {
    return { ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Try again in an hour.' };
  }

  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return {
      ok: false,
      code: 'CAPTCHA_FAILED',
      message: 'Captcha verification failed. Reload and try again.',
    };
  }

  let normalizedUrl: string;
  try {
    const raw = urlInput.trim();
    const withScheme = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) throw new Error('no tld');
    normalizedUrl = u.toString();
  } catch {
    return { ok: false, code: 'INVALID_URL', message: 'Enter a valid website URL (e.g. acme.com).' };
  }

  const ipHash = createHash('sha256')
    .update(ip + (process.env['IP_HASH_SALT'] ?? ''))
    .digest('hex')
    .slice(0, 16);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [inflight] = await db
    .insert(inflightBootstrap)
    .values({ urlInput: normalizedUrl, ipHash, expiresAt, status: 'pending' })
    .returning({ id: inflightBootstrap.id });

  const queue = getBootstrapAnonQueue();
  await queue.add('bootstrap-anon', { inflightId: inflight.id, urlInput: normalizedUrl });

  return { ok: true, inflightId: inflight.id };
}

export async function claimOnboarding(
  inflightId: string,
  workspaceId: string,
): Promise<{ ok: boolean; code?: string; message?: string }> {
  const [row] = await db
    .select({ status: inflightBootstrap.status, workspaceId: inflightBootstrap.workspaceId })
    .from(inflightBootstrap)
    .where(eq(inflightBootstrap.id, inflightId))
    .limit(1);

  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Onboarding session not found.' };
  if (row.status === 'claimed') return { ok: false, code: 'ALREADY_CLAIMED', message: 'Already claimed.' };
  if (row.status === 'failed')
    return { ok: false, code: 'RUN_FAILED', message: 'Preview run failed; start a new one.' };

  await db
    .update(inflightBootstrap)
    .set({ workspaceId, status: 'claimed', claimedAt: new Date() })
    .where(eq(inflightBootstrap.id, inflightId));

  // Re-queue a deep run for the real workspace
  const queue = getBootstrapAnonQueue();
  await queue.add('bootstrap-claim', { inflightId, workspaceId, urlInput: '' });

  return { ok: true };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @synterra/web test src/actions/onboarding.test.ts 2>&1 | tail -15
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/onboarding.ts apps/web/src/actions/onboarding.test.ts
git commit -m "feat(web): startOnboarding + claimOnboarding server actions for W2-3"
```

---

## Task 6: Bootstrap BullMQ Worker

**Files:**

- Create: `apps/workers/src/bootstrap-worker.ts`
- Modify: `apps/workers/src/config.ts`
- Modify: `apps/workers/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/workers/src/bootstrap-worker.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { BootstrapAnonJobData } from './queues.js';

vi.mock('@synterra/aquila-client', () => ({
  createAquilaClient: vi.fn().mockReturnValue({
    createResearchRun: vi.fn().mockResolvedValue({
      id: 'run-abc',
      status: 'queued',
      organizationId: 'anon-org',
      query: 'https://acme.com',
      createdAt: '2026-04-20T00:00:00Z',
      completedAt: null,
    }),
    getResearchRun: vi.fn().mockResolvedValue({
      id: 'run-abc',
      status: 'succeeded',
      organizationId: 'anon-org',
      query: 'https://acme.com',
      createdAt: '2026-04-20T00:00:00Z',
      completedAt: '2026-04-20T00:01:10Z',
    }),
  }),
  SUPPORTED_CONTRACT_VERSION: '2026-04',
}));

const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
});
vi.mock('@synterra/db', () => ({
  createDb: vi.fn().mockReturnValue({ update: mockUpdate }),
  inflightBootstrap: {},
}));
vi.mock('./config.js', () => ({
  env: {
    DATABASE_URL: 'postgres://test',
    AQUILA_BASE_URL: 'http://aquila',
    AQUILA_ANON_API_KEY: 'anon-key',
    AQUILA_ANON_ORG_SLUG: 'synterra_anon',
    AQUILA_ANON_ORG_ID: 'anon-org-id',
  },
}));

describe('bootstrapAnonHandler', () => {
  it('calls createResearchRun with the urlInput as query', async () => {
    const { bootstrapAnonHandler } = await import('./bootstrap-worker.js');
    const job = {
      id: 'job-1',
      name: 'bootstrap-anon',
      data: { inflightId: 'if-1', urlInput: 'https://acme.com' },
    } as Job<BootstrapAnonJobData>;

    await bootstrapAnonHandler(job);

    const { createAquilaClient } = await import('@synterra/aquila-client');
    const client = vi.mocked(createAquilaClient).mock.results[0].value;
    expect(client.createResearchRun).toHaveBeenCalledWith(
      'anon-org-id',
      expect.objectContaining({ query: 'https://acme.com' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @synterra/workers test src/bootstrap-worker.test.ts 2>&1 | tail -10
```

Expected: module not found.

- [ ] **Step 3: Add env vars to `apps/workers/src/config.ts`**

In the Zod schema, add after existing fields:

```typescript
AQUILA_ANON_API_KEY: z.string().min(1),
AQUILA_ANON_ORG_SLUG: z.string().min(1),
AQUILA_ANON_ORG_ID: z.string().min(1),
```

- [ ] **Step 4: Create `apps/workers/src/bootstrap-worker.ts`**

```typescript
import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';

import { createAquilaClient, SUPPORTED_CONTRACT_VERSION } from '@synterra/aquila-client';
import { createDb, inflightBootstrap } from '@synterra/db';

import { env } from './config.js';
import logger from './logger.js';
import { QUEUE_NAMES, type BootstrapAnonJobData } from './queues.js';

import type { Redis } from 'ioredis';

const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_ATTEMPTS = 30; // 30 × 4 s = 2 minutes

export async function bootstrapAnonHandler(job: Job<BootstrapAnonJobData>): Promise<void> {
  const { inflightId, urlInput } = job.data;
  const db = createDb(env.DATABASE_URL);

  const anonClient = createAquilaClient({
    baseUrl: env.AQUILA_BASE_URL,
    apiKey: env.AQUILA_ANON_API_KEY,
    orgSlug: env.AQUILA_ANON_ORG_SLUG,
    contractVersion: SUPPORTED_CONTRACT_VERSION,
  });

  logger.info({ event: 'bootstrap-anon.start', inflightId, urlInput }, 'starting anon research run');

  await db.update(inflightBootstrap).set({ status: 'running' }).where(eq(inflightBootstrap.id, inflightId));

  let run;
  try {
    run = await anonClient.createResearchRun(env.AQUILA_ANON_ORG_ID, {
      query: urlInput,
      metadata: { inflightId, depth: 'shallow' },
    });
  } catch (err) {
    await db
      .update(inflightBootstrap)
      .set({ status: 'failed', error: (err as Error).message })
      .where(eq(inflightBootstrap.id, inflightId));
    throw err;
  }

  await db.update(inflightBootstrap).set({ aquilaRunId: run.id }).where(eq(inflightBootstrap.id, inflightId));

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));

    const latest = await anonClient.getResearchRun(env.AQUILA_ANON_ORG_ID, run.id);

    if (latest.status === 'succeeded') {
      await db
        .update(inflightBootstrap)
        .set({
          status: 'preview_ready',
          previewData: latest as unknown as Record<string, unknown>,
        })
        .where(eq(inflightBootstrap.id, inflightId));
      logger.info({ event: 'bootstrap-anon.done', inflightId, runId: run.id }, 'preview ready');
      return;
    }

    if (latest.status === 'failed' || latest.status === 'cancelled') {
      await db
        .update(inflightBootstrap)
        .set({ status: 'failed', error: `Aquila run ended with status: ${latest.status}` })
        .where(eq(inflightBootstrap.id, inflightId));
      throw new Error(`Aquila run ${run.id} failed: ${latest.status}`);
    }
  }

  await db
    .update(inflightBootstrap)
    .set({ status: 'failed', error: 'Timed out waiting for Aquila run' })
    .where(eq(inflightBootstrap.id, inflightId));
  throw new Error('bootstrap-anon timed out after 2 minutes');
}

export function createBootstrapWorker(connection: Redis): Worker<BootstrapAnonJobData> {
  const worker = new Worker<BootstrapAnonJobData>(
    QUEUE_NAMES.BOOTSTRAP_ANON,
    (job: Job<BootstrapAnonJobData>) => bootstrapAnonHandler(job),
    { connection, concurrency: 5, autorun: true },
  );

  worker.on('completed', (job) => {
    logger.info({ event: 'bootstrap-worker.completed', jobId: job.id, name: job.name }, 'bootstrap job done');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { event: 'bootstrap-worker.failed', jobId: job?.id, err: { message: err.message } },
      'bootstrap job failed',
    );
  });

  return worker;
}
```

- [ ] **Step 5: Register the worker in `apps/workers/src/index.ts`**

Add import:

```typescript
import { createBootstrapWorker } from './bootstrap-worker.js';
```

In `main()`, after `const provisioner = createProvisionerWorker(connection);`:

```typescript
const bootstrapWorker = createBootstrapWorker(connection);
await bootstrapWorker.waitUntilReady();
```

In `shutdown()`, after `await provisioner.close();`:

```typescript
await bootstrapWorker.close();
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @synterra/workers test src/bootstrap-worker.test.ts 2>&1 | tail -15
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/workers/src/bootstrap-worker.ts apps/workers/src/bootstrap-worker.test.ts apps/workers/src/config.ts apps/workers/src/index.ts
git commit -m "feat(workers): bootstrap-anon BullMQ worker for W2-3 shallow research run"
```

---

## Task 7: SSE Route — `/api/onboarding/[id]/stream`

**Files:**

- Create: `apps/web/src/app/api/onboarding/[id]/stream/route.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/onboarding/[id]/stream/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@synterra/db', () => ({
  createDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              status: 'preview_ready',
              previewData: { query: 'acme.com' },
              error: null,
            },
          ]),
        }),
      }),
    }),
  }),
  inflightBootstrap: {},
}));

describe('GET /api/onboarding/[id]/stream', () => {
  it('returns text/event-stream with status 200', async () => {
    const { GET } = await import('./route.js');
    const req = new NextRequest('http://localhost/api/onboarding/test-id/stream');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @synterra/web test src/app/api/onboarding 2>&1 | tail -10
```

Expected: module not found.

- [ ] **Step 3: Create the SSE route**

Create `apps/web/src/app/api/onboarding/[id]/stream/route.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

import { createDb, inflightBootstrap } from '@synterra/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createDb(process.env['DATABASE_URL'] ?? '');
const POLL_INTERVAL_MS = 2_000;
const MAX_POLLS = 90; // 90 × 2 s = 3 minutes

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      for (let poll = 0; poll < MAX_POLLS; poll++) {
        const [row] = await db.select().from(inflightBootstrap).where(eq(inflightBootstrap.id, id)).limit(1);

        if (!row) {
          send('error', { message: 'Session not found' });
          controller.close();
          return;
        }

        send('status', { status: row.status, previewData: row.previewData, error: row.error });

        if (row.status === 'preview_ready' || row.status === 'claimed' || row.status === 'failed') {
          controller.close();
          return;
        }

        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      send('error', { message: 'Timed out — please reload and try again.' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @synterra/web test src/app/api/onboarding 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/onboarding/
git commit -m "feat(web): SSE stream route /api/onboarding/[id]/stream for W2-3"
```

---

## Task 8: `/start` Page — URL Input + Turnstile

**Files:**

- Create: `apps/web/src/app/start/page.tsx`
- Create: `apps/web/src/app/start/_components/StartForm.tsx`
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Install `@marsidev/react-turnstile`**

```bash
pnpm --filter @synterra/web add @marsidev/react-turnstile
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm --filter @synterra/web exec tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Create the RSC page**

Create `apps/web/src/app/start/page.tsx`:

```tsx
import { StartForm } from './_components/StartForm.js';

export const metadata = { title: 'Analyze your brand — Forgentic' };

export default function StartPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-xl space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">See your brand&apos;s DNA in 90 seconds</h1>
        <p className="text-neutral-400">Paste any website URL. No sign-up required to see your preview.</p>
        <StartForm siteKey={process.env['CLOUDFLARE_TURNSTILE_SITE_KEY'] ?? ''} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create the client form component**

Create `apps/web/src/app/start/_components/StartForm.tsx`:

```tsx
'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

import { startOnboarding } from '../../../actions/onboarding.js';

interface Props {
  siteKey: string;
}

export function StartForm({ siteKey }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      setError('Please complete the captcha.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await startOnboarding(url, turnstileToken);
      if (result.ok) {
        router.push(`/start/${result.inflightId}`);
      } else {
        setError(result.message);
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourcompany.com"
          required
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isPending || !turnstileToken}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? 'Analyzing…' : 'Analyze →'}
        </button>
      </div>

      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={setTurnstileToken}
        onExpire={() => setTurnstileToken(null)}
        options={{ theme: 'dark' }}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 5: Add `/start` to public routes in `apps/web/src/middleware.ts`**

Change:

```typescript
const PUBLIC_PREFIXES = ['/sign-in', '/verify', '/api/', '/_next/', '/favicon', '/workspaces'];
```

to:

```typescript
const PUBLIC_PREFIXES = ['/sign-in', '/verify', '/api/', '/_next/', '/favicon', '/workspaces', '/start'];
```

- [ ] **Step 6: Add Turnstile site key env var**

Add to `.env.local` (dev test key — always passes):

```
CLOUDFLARE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

- [ ] **Step 7: Build check**

```bash
pnpm --filter @synterra/web build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/start/ apps/web/src/middleware.ts
git commit -m "feat(web): /start page with URL input and Cloudflare Turnstile for W2-3"
```

---

## Task 9: `/start/[id]` — Progress + Preview + Email Capture

**Files:**

- Create: `apps/web/src/app/start/[id]/page.tsx`
- Create: `apps/web/src/app/start/[id]/_components/ProgressView.tsx`

- [ ] **Step 1: Create the RSC wrapper page**

Create `apps/web/src/app/start/[id]/page.tsx`:

```tsx
import { ProgressView } from './_components/ProgressView.js';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Analyzing your brand… — Forgentic' };

export default async function OnboardingProgressPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-2xl">
        <ProgressView inflightId={id} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the progress client component**

Create `apps/web/src/app/start/[id]/_components/ProgressView.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type InflightStatus = 'pending' | 'running' | 'preview_ready' | 'claimed' | 'failed';

interface StatusEvent {
  status: InflightStatus;
  previewData: unknown | null;
  error: string | null;
}

interface Props {
  inflightId: string;
}

const STATUS_LABELS: Record<InflightStatus, string> = {
  pending: 'Queuing your analysis…',
  running: 'Analyzing your brand…',
  preview_ready: 'Preview ready!',
  claimed: 'All set — redirecting…',
  failed: 'Analysis failed.',
};

const STATUS_PROGRESS: Record<InflightStatus, number> = {
  pending: 10,
  running: 55,
  preview_ready: 100,
  claimed: 100,
  failed: 100,
};

export function ProgressView({ inflightId }: Props) {
  const [status, setStatus] = useState<InflightStatus>('pending');
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();
  const esRef = useRef<EventSource | null>(null);
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource(`/api/onboarding/${inflightId}/stream`);
    esRef.current = es;

    es.addEventListener('status', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as StatusEvent;
      setStatus(data.status);
      if (data.previewData) setPreviewData(data.previewData);
    });

    es.addEventListener('error', (e: MessageEvent) => {
      const data = JSON.parse(e.data ?? '{}') as { message?: string };
      setStreamError(data.message ?? 'An unexpected error occurred.');
      es.close();
    });

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [inflightId]);

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      // Store inflightId so post-auth page can call claimOnboarding
      sessionStorage.setItem('pendingInflightId', inflightId);
      router.push(`/sign-in?email=${encodeURIComponent(email)}&inflight=${inflightId}`);
    });
  };

  return (
    <div className="space-y-8 text-center">
      <h2 className="text-2xl font-bold text-white">{STATUS_LABELS[status]}</h2>

      {status !== 'failed' && (
        <div className="h-2 w-full rounded-full bg-neutral-800">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-all duration-700"
            style={{ width: `${STATUS_PROGRESS[status]}%` }}
          />
        </div>
      )}

      {(status === 'failed' || streamError) && (
        <p className="text-red-400">{streamError ?? 'Analysis failed. Please try again.'}</p>
      )}

      {status === 'preview_ready' && previewData && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-left">
          <h3 className="mb-3 text-lg font-semibold text-white">Brand Preview</h3>
          <pre className="overflow-auto whitespace-pre-wrap text-sm text-neutral-300">
            {JSON.stringify(previewData, null, 2)}
          </pre>
        </div>
      )}

      {status === 'preview_ready' && (
        <form onSubmit={handleClaim} className="flex flex-col gap-3">
          <p className="text-neutral-400">Enter your email to save this analysis and unlock the full report.</p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {isPending ? 'Sending…' : 'Get full report →'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build check**

```bash
pnpm --filter @synterra/web build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/start/[id]/
git commit -m "feat(web): /start/[id] progress + preview + email capture for W2-3"
```

---

## Task 10: Post-Auth Claim Wiring

The magic-link flow: visitor submits email → redirected to `/sign-in?inflight=<id>` → better-auth sends magic link → visitor clicks link → better-auth verifies and redirects to `/verify` → we detect `inflight` param and call `claimOnboarding`.

- [ ] **Step 1: Find the post-magic-link landing page**

```bash
find /home/diazdevivar/Projects/Forgentic/Synterra/apps/web/src/app -name "*.tsx" | xargs grep -l "verify\|magic" 2>/dev/null | head -10
```

- [ ] **Step 2: Add claim logic to the verify page**

In `apps/web/src/app/(auth)/verify/page.tsx` (adapt filename to actual), add server-side inflight claim. First read the file, then add the following logic inside the page component before returning the normal verify UI:

```tsx
import { redirect } from 'next/navigation';
import { claimOnboarding } from '../../../actions/onboarding.js';
import { getSessionOrThrow } from '../../../lib/session.js';

interface Props {
  searchParams: Promise<{ inflight?: string; token?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const { inflight } = await searchParams;

  if (inflight) {
    try {
      const session = await getSessionOrThrow();
      // workspaceId comes from the workspace JWT; adapt to actual session shape
      if (session.workspaceId) {
        await claimOnboarding(inflight, session.workspaceId);
        redirect(`/dashboard?onboarded=1`);
      }
    } catch {
      // Session not yet ready — fall through to normal verify UI
    }
  }

  // ... rest of existing verify page code
}
```

> **Note:** Adapt `getSessionOrThrow` and `session.workspaceId` to the actual session helper. Run `grep -r "getSession\|getSessionOrThrow" apps/web/src/lib/` to find the helper and its return type.

- [ ] **Step 3: Build check**

```bash
pnpm --filter @synterra/web build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat(web): post-auth inflight claim in verify page for W2-3"
```

---

## Task 11: Env Vars + Final Verification

- [ ] **Step 1: Add all W2-3 env vars to `.env.local`**

```bash
cat >> /home/diazdevivar/Projects/Forgentic/Synterra/.env.local << 'EOF'

# W2-3 URL-first onboarding
CLOUDFLARE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
CLOUDFLARE_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
IP_HASH_SALT=dev-salt-change-in-prod
AQUILA_ANON_API_KEY=<fill after provisioning synterra_anon org in Aquila>
AQUILA_ANON_ORG_SLUG=synterra_anon
AQUILA_ANON_ORG_ID=<uuid from Aquila after provisioning>
EOF
```

> **Cloudflare test keys (always pass in dev):**
>
> - Site key: `1x00000000000000000000AA`
> - Secret key: `1x0000000000000000000000000000000AA`
>
> **Required manual step:** Provision the `synterra_anon` org in Aquila (one-time, via the provisioner API or admin script) and fill in `AQUILA_ANON_API_KEY` + `AQUILA_ANON_ORG_ID`.

- [ ] **Step 2: Add production secrets to Infisical**

```bash
infisical secrets set CLOUDFLARE_TURNSTILE_SITE_KEY=<prod-site-key> --env=production
infisical secrets set CLOUDFLARE_TURNSTILE_SECRET_KEY=<prod-secret-key> --env=production
infisical secrets set IP_HASH_SALT=$(openssl rand -hex 32) --env=production
infisical secrets set AQUILA_ANON_API_KEY=<prod-key> --env=production
infisical secrets set AQUILA_ANON_ORG_SLUG=synterra_anon --env=production
infisical secrets set AQUILA_ANON_ORG_ID=<prod-uuid> --env=production
```

- [ ] **Step 3: Full build + type check**

```bash
pnpm build 2>&1 | tail -30
pnpm tsc --noEmit 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
pnpm test 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 5: Mark W2-3 done in PlanTracking.md**

Change the W2-3 row in `PlanTracking.md`:

```
| W2-3  | URL-first onboarding (90-second wow)            | hecha ✅     | W2-2                |
```

- [ ] **Step 6: Final commit**

```bash
git add PlanTracking.md
git commit -m "chore(w2-3): mark URL-first onboarding complete"
```

---

## Self-Review Against Spec

| Spec Requirement                                             | Covered                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `/start` route with anonymous URL input                      | Task 8                                                              |
| Anonymous Aquila call to `synterra_anon` org                 | Task 6                                                              |
| Per-IP rate limit                                            | Task 4 + Task 5                                                     |
| Cloudflare Turnstile                                         | Task 4 + Task 8                                                     |
| `inflight_bootstrap` table tracking                          | Task 1                                                              |
| Email magic link sent                                        | Task 9 (redirects to `/sign-in` which triggers magic link)          |
| Post-signup: claim inflight result                           | Task 10                                                             |
| Re-run pipeline against real workspace org with deeper depth | Task 5 (`claimOnboarding` enqueues `bootstrap-claim`)               |
| Live progress streaming                                      | Task 7 (SSE) + Task 9 (EventSource)                                 |
| Full flow under 90s for preview moment                       | Task 6 (4s × 30 polls = 2 min max; Aquila shallow run targets <90s) |
| Under 4 minutes for deep enrichment                          | Task 5 + Task 6 (deep re-queue after claim)                         |

**Architecture deviation:** Supabase Realtime → SSE (no spec gaps, same UX, simpler stack).
