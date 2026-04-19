# Forgentic (codename: Synterra) — project-specific CLAUDE.md

This file layers Synterra-specific conventions on top of the root `../CLAUDE.md` workflow. Everything in the root doc (plan-mode-first, subagent liberalism, self-improvement loop, verification before done, elegance, autonomous bug fixing, simplicity first) applies — this file adds the rules that are unique to the Synterra multi-tenant control plane.

---

## Canonical references (load these in order for any non-trivial change)

1. **`../CLAUDE.md`** — root workflow + task management + core principles.
2. **`PLAN.md`** — 1720-line architecture + 11-workstream roadmap. Section numbers (§A..§P, W0-1..W10-3) are the authoritative address for every feature/decision. Quote them in PR descriptions, ADRs, and commit bodies.
3. **`tasks/todo.md`** — the live workstream tracker. Every `[ ]` must close before W0-1 is declared done. Update this file in the same PR that lands the change.
4. **`tasks/lessons.md`** — patterns we've learned the hard way. Read at session start. Append after every correction.
5. **`CONTRIBUTING.md`** — commit convention + hook behaviour + troubleshooting.

When in doubt, read the doc instead of improvising. PRs that contradict PLAN.md without an ADR in `docs/ADR/` get rejected.

---

## The non-negotiable architectural invariants

These are enforced by tests, by CI, and by reviewers. Breaking any of them requires an ADR in `docs/ADR/` and explicit architect sign-off.

### 1. Control plane vs. data plane is a hard boundary

- **Forgentic (this repo)** is the _control plane_ — customer-facing SaaS workspace: auth, billing, workspace CRUD, UI, in-app dashboards.
- **Aquila** is the _data plane_ — research workers, Neo4j graph, scraping pipeline, LLM enrichment.
- They communicate via `@synterra/aquila-client` over versioned HTTP. **Never import Aquila code directly** — not even types. The client's `contractVersion` field pins a date-stamped contract; mismatches throw at factory time.
- Adding a new Aquila dependency? File it as an AQ-N change in `Aquila/tasks/todo.md` and block your Synterra PR until it lands on the Aquila side.

### 2. Every row has a `workspace_id`

Multi-tenancy is row-level, enforced by Postgres RLS plus query-layer discipline:

- **No query may omit `workspace_id` from the `WHERE` clause** unless it runs under an explicit service-role escape hatch documented in `packages/db`. That escape hatch is reserved for admin-console read-models and cross-workspace usage aggregation.
- Drizzle query helpers (`withWorkspaceContext`) wrap transactions so `SET LOCAL synterra.workspace_id = $1` is always set before the first read/write.
- Every RLS-protected table must ship with a cross-workspace-denial test. The `synterra-test-writer` agent enforces this at review time.

### 3. Forgentic is the public brand; Synterra is the codename

- User-facing surface (`apps/web/**`, marketing docs, emails, UI copy) uses "**Forgentic**" only.
- "Synterra" only appears as the npm scope (`@synterra/*`), inside `PLAN.md`, agent names, internal commit messages, and anywhere no customer will ever see it.
- `apps/web/src/app/page.test.tsx` already asserts the rendered HTML contains zero `synterra` occurrences. A repo-wide grep gate backs this up in CI (see `scripts/check-brand.sh`).

### 4. Workspaces are isolation; schemas are shared

Shared-schema + RLS, not schema-per-tenant and not database-per-tenant. Every tenant-scoped table has a `workspace_id uuid not null references workspaces(id)` column and a matching RLS policy. Schema-per-tenant is explicitly rejected: it scales badly and multiplies our migration surface by the tenant count.

### 5. Secrets never touch code

- No hardcoded API keys, JWT secrets, database URLs, Stripe tokens, Aquila API keys, etc. Ever.
- Runtime config is parsed via `zod` from `process.env` at boot and validated before the app accepts a single request. Missing/invalid env → exit 1 with a readable list of offending keys.
- Production secrets live in Infisical (project: "Forgentic"). Dev secrets live in `.env.local` (git-ignored).
- Logs + error payloads never include authorization headers, cookies, tokens, passwords, or API keys — pino's `redact` paths cover these globally.

### 6. Every service has `/health`

- `apps/web`: `GET /api/health` → `{ status:'ok', version, uptime }` with `Cache-Control: no-store`.
- `apps/api`: `GET /v1/health` → same shape, same headers.
- `apps/workers`: HTTP sidecar on `HEALTH_PORT` (default 3002) with `/health` + `/ready` (503 when redis isn't ready).

Health is for liveness + version reporting. It must never require a database roundtrip (readiness does).

### 7. Graceful shutdown is not optional

SIGTERM + SIGINT + uncaughtException + unhandledRejection all funnel through a single shutdown() path with a hard-kill `setTimeout(...).unref()` fallback. If you add a new long-lived resource (queue, websocket, background job), register its teardown in that same path.

---

## Package naming + workspace layout

- Every workspace is `@synterra/<kebab-case-name>`. The `@synterra/` scope is a namespace identifier, not public branding (see invariant 3).
- Apps live under `apps/<name>/` (`web`, `api`, `workers`).
- Shared code lives under `packages/<name>/` — flat, one level deep. If a package needs sub-packages, it probably shouldn't exist yet.
- Cross-workspace imports go through the package name (`import { ... } from '@synterra/shared'`) — never relative paths (`../../../shared`).

## Commit + PR workflow

- Conventional commits are mandatory, enforced by `commitlint.config.cjs` at commit-msg + CI. See `CONTRIBUTING.md` for scopes + examples.
- One PR = one workstream item (`W0-1 §G`, `AQ-1`, etc.). Reference the workstream in the PR title or body so the plan stays traceable.
- `tasks/todo.md` must be updated in the same PR that closes a workstream item.
- Screenshots for UI changes; `tasks/lessons.md` entry for anything that surprised you.

## Testing stance

- Unit tests (Vitest) live next to the code: `foo.ts` + `foo.test.ts`. Packages use the workspace's own `vitest.config.ts`; the root `vitest.config.ts` only aggregates via `test.projects`.
- Integration tests that need real Postgres or Redis use **Testcontainers**, not mocks. `ioredis-mock` + `bullmq` has known incompatibilities (see `apps/workers/src/index.test.ts` comment) — the real-container path is what ships.
- E2E (Playwright chromium + webkit + mobile-chromium) covers the critical customer flows. See `tests/e2e/playwright.config.ts`.
- Coverage floor is 80% statements / 70% branches / 80% functions / 80% lines in every workspace. Don't silence the threshold — add tests.

## When you get stuck

1. Re-read `PLAN.md` section referenced by the task.
2. Read the relevant `synterra-<role>` agent's system prompt to check the invariants it enforces.
3. Look at the Aquila equivalent — the data plane solved most of these problems already.
4. If still stuck, file a `docs/ADR/` with the decision points and wait for architect sign-off.

**Never silently weaken an invariant** (RLS, workspace_id, no-Aquila-imports, brand purity, secret hygiene, graceful shutdown, health endpoints) to unblock yourself. That's how the multi-tenant house burns down.
