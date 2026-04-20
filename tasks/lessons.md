# Lessons — Forgentic (Synterra)

Append-only log of patterns we've learned the hard way. Read at session start before any non-trivial change. After each correction by the user, add an entry. Format every entry as:

```
## <date> — <short-title>

**What we tried:** …
**What went wrong:** …
**Lesson / rule:** …
**Where it applies:** …
```

Entries sorted newest-first.

---

## 2026-04-19 — BullMQ queue names reject `:`

**What we tried:** Used `synterra:default` as the BullMQ default queue name (mirroring the Aquila convention of `aquila:*` namespaces).

**What went wrong:** BullMQ 5 throws `Error: Queue name cannot contain :` the moment the `new Queue(...)` / `new Worker(...)` constructor runs, because `:` is BullMQ's internal Redis key separator. Three worker tests failed simultaneously on construction.

**Lesson / rule:** Use kebab-case (`synterra-default`, `synterra-provisioner`, `synterra-usage-aggregator`, etc.) for every BullMQ queue name. Never introduce `:` or `/` into queue identifiers. A regression test in `apps/workers/src/index.test.ts` asserts `QUEUE_NAMES.DEFAULT does not contain ':'` — extend it if we add more queues.

**Where it applies:** Any new `packages/workers/src/queues.ts` constant, any Queue/Worker constructor call, any documentation that references queue names.

---

## 2026-04-19 — Imported from Aquila — RLS + `workspace_id` discipline

**What we tried (Aquila):** Early Aquila routes omitted `org_id` from queries when the operator "knew" the context.

**What went wrong:** Cross-org data leakage in a staging test; required a 2-week remediation sweep adding `org_id` to every query.

**Lesson / rule for Synterra:** **Every** query against a workspace-scoped table includes `workspace_id` in the `WHERE` clause. Drizzle's `withWorkspaceContext` helper sets `SET LOCAL synterra.workspace_id` and wraps the operation in a transaction. No exceptions outside the explicit admin-console service-role path. Cross-workspace denial tests are mandatory for every RLS-protected table.

**Where it applies:** `packages/db/src/**`, any Server Action, any Hono route handler in `apps/api`, any BullMQ job handler that reads or writes tenant data.

---

## 2026-04-19 — Imported from Aquila — Subagent specificity beats genericity

**What we tried (Aquila):** Early Aquila had a "generic-backend" agent that handled everything from routes to workers to infra.

**What went wrong:** The generic agent produced adequate-but-bland work; reviewers couldn't tell whether Hono idioms, BullMQ patterns, or observability conventions were being respected. Quality plateaued.

**Lesson / rule for Synterra:** The 10 Synterra subagents each own a narrow surface (`synterra-backend-engineer` vs `synterra-auth-engineer` vs `synterra-aquila-bridge`). Their system prompts encode the specific patterns, gotchas, and handoff contracts for that surface. Never collapse two agents into one to "save roles" — the per-agent memory scratchpad compounds over sessions.

**Where it applies:** `.claude/agents/*`, subagent dispatch decisions, review assignments.

---

## 2026-04-19 — Imported from Aquila — `org_id` is a data-model property, not a runtime concern

**What we tried (Aquila):** Attempted to enforce tenancy at the HTTP middleware layer only, relying on routes to remember to pass `org_id` into service calls.

**What went wrong:** Any new service method that forgot to thread the context silently queried the whole table.

**Lesson / rule for Synterra:** Tenancy context (`workspace_id`) is propagated through the data layer via transaction-local Postgres settings (`SET LOCAL`), not through function parameters. RLS enforces the final barrier. Middleware remains the entry point, but is _not_ the enforcement layer. This matches Aquila's post-remediation posture.

**Where it applies:** `packages/db`, all Server Actions, `apps/api` middleware chain.

---

## 2026-04-19 — Traefik v3.3 incompatible with Docker Engine 28 API

**What we tried:** `traefik:v3.3` with Docker Engine 28 (API 1.54) on LXC.

**What went wrong:** Traefik's bundled Go Docker client negotiates API 1.24, which Docker 28 dropped. Error: "client version 1.24 is too old. Minimum supported API version is 1.40". `DOCKER_API_VERSION` env var has no effect because Traefik creates its Docker client without `client.FromEnv`.

**Lesson / rule:** Pin `traefik:latest` (or a version known to bundle docker/docker v28+). Check Traefik release notes for Docker API support before pinning a specific version.

**Where it applies:** `infra/lxc-app/docker-compose.yml` Traefik image tag.

---

## 2026-04-19 — Alpine Linux `localhost` resolves IPv6 first

**What we tried:** Docker HEALTHCHECK using `wget -qO- http://localhost:3000/api/health` inside Alpine-based containers.

**What went wrong:** Alpine's `localhost` resolves to `::1` (IPv6) first. Node.js binds `0.0.0.0` (IPv4 only) by default. wget fails with "can't connect to remote host" even though the server is up.

**Lesson / rule:** Always use `http://127.0.0.1:<port>` (explicit IPv4) in Docker healthchecks for Alpine images. Never use `localhost`.

**Where it applies:** All `HEALTHCHECK` directives and compose `healthcheck.test` for Node.js services.

---

## 2026-04-19 — pnpm workspace `node_modules` not in Docker runner `$NODE_PATH`

**What we tried:** Workers Dockerfile runner stage copied only root `node_modules` to `/app/node_modules`, placed dist at `/app/dist/index.mjs`.

**What went wrong:** pnpm stores workspace-specific deps (like `zod`) in `apps/workers/node_modules/`, not the root. Node resolves from the file's directory upward — from `/app/dist/` it never reaches `apps/workers/node_modules/`.

**Lesson / rule:** Keep the monorepo path structure in the runner stage: put dist at `apps/<name>/dist/` and copy both root and workspace `node_modules`. Then Node walks `/app/apps/<name>/dist/ → /app/apps/<name>/node_modules/ → /app/node_modules/`.

**Where it applies:** All pnpm-workspace Docker runners that don't fully bundle dependencies.

---

## 2026-04-19 — Grafana Agent v0.43 static mode, not Flow mode

**What we tried:** `grafana/agent:v0.43.3` with `command: run /etc/agent/config.river`.

**What went wrong:** The `grafana/agent` image defaults to static mode (expects `-config.file`). The `run` subcommand for River/Flow config is in `grafana/agent-flow` or the newer `grafana/alloy`.

**Lesson / rule:** Use `grafana/alloy:latest` for River (Flow) configs. It's the official successor; command is `run --server.http.listen-addr=0.0.0.0:12345 --storage.path=/tmp/alloy/data /etc/alloy/config.alloy`.

**Where it applies:** `infra/lxc-app/docker-compose.yml` grafana-agent service.

---

## 2026-04-19 — RLS policies can't forward-reference tables not yet created

**What we tried:** `0002_workspaces.sql` created RLS policies on `workspaces` that referenced `workspace_members`, which is created in `0003_memberships.sql`.

**What went wrong:** `relation "workspace_members" does not exist` at policy creation time.

**Lesson / rule:** RLS policies that reference other tables must run AFTER those tables exist. Move cross-table policies to the migration that creates the referenced table (or a later one). Never write RLS policies forward-referencing tables in later migrations.

**Where it applies:** `packages/db/migrations/` whenever adding RLS policies that JOIN or subquery other tables.

---

## 2026-04-19 — UNIQUE constraints on partitioned tables must include the partition key

**What we tried:** `idempotency_key TEXT UNIQUE` on the `usage_events` table partitioned by `RANGE (created_at)`.

**What went wrong:** Postgres error: "unique constraint on partitioned table must include all partitioning columns". A simple UNIQUE constraint can't span partitions without the partition key.

**Lesson / rule:** On range-partitioned tables, replace inline `UNIQUE` column constraints with `CREATE UNIQUE INDEX ... (unique_col, partition_key) WHERE condition`. This enforces uniqueness within each partition.

**Where it applies:** Any partitioned table (`usage_events`, `audit_log`) where uniqueness is needed.

---

## 2026-04-19 — tsup externalizes node_modules by default; workspace packages need `noExternal`

**What we tried:** `bundle: true` in tsup config for workers/api, expecting all imports (including `@synterra/telemetry`) to be inlined.

**What went wrong:** tsup externalizes all `node_modules` packages by default — even workspace packages. The built `dist/index.mjs` had `import { initTelemetry } from "@synterra/telemetry"` as a live runtime import, which fails in the Docker runner stage where `packages/telemetry/` doesn't exist.

**Lesson / rule:** Add `noExternal: [/@synterra\/.*/]` to tsup config for any app that imports workspace packages. Also add `external: [/^@opentelemetry\//]` — OTel packages are CJS and use dynamic `require()` internally; bundling them into ESM breaks at runtime.

**Where it applies:** `apps/*/tsup.config.ts` whenever adding workspace package imports.

---

## 2026-04-19 — OTel CJS packages must be direct deps in workers package.json for Docker runner

**What we tried:** Externalized `@opentelemetry/*` from tsup bundle (correct), relying on them being transitive deps of `@synterra/telemetry`.

**What went wrong:** The Docker runner stage copies `apps/workers/node_modules` from the deps stage. Transitive deps of workspace packages may be isolated in `packages/telemetry/node_modules/`, not hoisted to `apps/workers/node_modules`. At runtime: `ERR_MODULE_NOT_FOUND: @opentelemetry/exporter-trace-otlp-http`.

**Lesson / rule:** Any package that is externalized in the bundle AND needed at runtime MUST be a direct dependency of the app (in `apps/workers/package.json`). Don't rely on transitive hoisting inside Docker multi-stage builds.

**Where it applies:** `apps/workers/package.json` and `apps/api/package.json` — OTel, prom-client, and any other externalized runtime deps.

---

## 2026-04-19 — Docker layer cache survives `--build` when only package.json changes; use `--no-cache` when deps change

**What we tried:** `docker compose up -d --build --force-recreate` after modifying `apps/workers/package.json`.

**What went wrong:** Docker used the cached layer for `RUN pnpm install` from a previous build where the lockfile was the same. The pnpm lockfile didn't change (packages were already in the global lockfile). Result: old deps in the image.

**Lesson / rule:** After adding new direct deps to an app's `package.json`, add `--no-cache` flag to the Docker build for that service. `--build` only busts cache when Docker detects file content changes in COPY layers; if the file change doesn't propagate to a different `pnpm install` outcome, the cache may still be used.

**Where it applies:** Any deploy that adds new direct deps to `apps/*/package.json`.

---

## 2026-04-19 — Infisical CLI dotenv export wraps values in single-quotes; strip them in deploy script

**What we tried:** `infisical export --format=dotenv > .env`, then using `.env` with docker compose `--env-file` and shell `export`.

**What went wrong:** Infisical CLI outputs `KEY='value'` with literal single-quote delimiters. Shell `export "$line"` treats quotes as part of the value. Docker compose `--env-file` also passes them literally on some versions. Result: `CLOUDFLARE_TUNNEL_TOKEN` had quotes → "Tunnel token is not valid"; `DATABASE_URL` had quotes → `Invalid URL`.

**Lesson / rule:** After `infisical export`, run: `sed -i "s/='\(.*\)'\s*$/=\1/" .env && sed -i 's/="\(.*\)"\s*$/=\1/' .env` to strip both quote styles. This was added to `deploy-synterra.sh`.

**Where it applies:** Any deploy script that uses `infisical export --format=dotenv`.

---

## 2026-04-19 — Observability LXC must be bootstrapped before W0-4 verification

**What we tried:** Verifying OTel traces in Tempo at `http://192.168.10.54:3200` right after deploying app containers.

**What went wrong:** The observability LXC (192.168.10.54) never had Docker installed or the observability stack deployed. Tempo was not running. App containers were sending spans to an unreachable endpoint.

**Lesson / rule:** Before deploying app instrumentation, verify the observability stack is running: `curl http://192.168.10.54:3200/ready`. Bootstrap with `bootstrap-lxc.sh observability` + rsync `infra/lxc-observability/` + `docker compose up -d`.

**Where it applies:** Any new LXC role — always verify the target service exists before wiring up clients.

---

## W2-3 — Lessons learned (2026-04-20)

- **Subagents must use `git -C <worktree-path>` for all git commands.** Without this, commits land on the main working tree's current branch instead of the feature branch, requiring cherry-pick + revert cleanup.
- **service_role conditional in migrations**: The `service_role` Postgres role only exists in Supabase. Vanilla Postgres (used by Testcontainers) doesn't have it. Always wrap `CREATE POLICY ... TO service_role` in `DO $$ IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role')` to avoid Testcontainer integration test breakage.
- **ESLint import/order in this repo**: Local value imports sort BEFORE external type imports in the same group (opposite of common convention). Run `pnpm eslint --fix` after adding imports.
- **tsc false positives on `.js` imports**: `Cannot find module './foo.js'` in IDE diagnostics is a false positive for ESM `.ts` source files. `tsc --noEmit` passes; ignore IDE warnings.
- **SSE vs Supabase Realtime**: Supabase Realtime is not in this stack. Native ReadableStream SSE in Next.js Route Handlers achieves identical real-time UX with zero new infrastructure.

---

_(New lessons land here — newest first.)_
