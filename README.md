# Forgentic

> Multi-tenant SaaS workspace for brand intelligence, built on the Aquila data plane.

**Codename:** `Synterra` (internal only — public brand is **Forgentic**).

---

## What this repo is

Forgentic is the **customer-facing control plane**: Next.js 16 + Drizzle + Postgres + better-auth + Stripe + Lago. It talks to **Aquila** (the data plane — FastAPI + Arq workers + Neo4j, lives in a separate repo) only via versioned HTTP contracts.

The implementation plan lives in **[`PLAN.md`](./PLAN.md)** — 17 sections, 11 workstream groups (W0–W10), every architectural decision recorded. Read that before touching code.

## Stack

| Layer           | Choice                                            |
| --------------- | ------------------------------------------------- |
| Runtime         | Node 22 LTS                                       |
| Package manager | pnpm 10 (workspaces)                              |
| Task graph      | Turborepo 2                                       |
| Language        | TypeScript 5.9 (strict)                           |
| Web             | Next.js 16 · React 19 · Tailwind v4 · shadcn/ui   |
| API             | Hono on Node · pino · zod                         |
| Workers         | BullMQ · Redis 7                                  |
| DB              | Postgres 16 · Drizzle ORM · RLS per workspace     |
| Auth            | better-auth · WorkOS SSO proxy                    |
| Billing         | Stripe · Lago (self-hosted metering)              |
| Testing         | Vitest · Playwright · Testcontainers              |
| Observability   | OpenTelemetry · Grafana · Loki · Prometheus       |
| Pre-commit      | lefthook (parallel, workspace-aware) · commitlint |

## Repository layout

```
apps/
  web/              Next.js 16 — customer-facing app
  api/              Public HTTP API (Hono on /v1/*)
  workers/          BullMQ worker process
packages/
  db/               Drizzle schema + migrations + RLS policies
  auth/             better-auth config + WorkOS adapter
  billing/          Stripe + Lago glue
  aquila-client/    Typed HTTP client for Aquila
  ui/               shadcn components + Forgentic design tokens
  emails/           React Email templates
  telemetry/        OpenTelemetry init + tenant context
  shared/           Cross-package zod schemas + types
infra/              Docker, deploy scripts, Grafana dashboards
docs/               ARCHITECTURE, API, ONBOARDING, BILLING, SECURITY, RUNBOOKS
tests/              E2E (Playwright), integration (Testcontainers)
.claude/agents/     Specialized Claude Code subagents for this project
tasks/              todo.md (active workstream) + lessons.md
```

## Quickstart

```bash
# Prereqs: Node 22, pnpm 10, Docker (for local Postgres/Redis)
nvm use                              # picks Node 22 from .nvmrc
corepack enable                      # activates pnpm pinned in packageManager
pnpm install                         # workspace install
docker compose -f infra/docker-compose.yml up -d   # Postgres + Redis + Mailpit
pnpm dev                             # turbo runs web/api/workers in parallel
```

| URL                      | Surface                |
| ------------------------ | ---------------------- |
| http://localhost:3000    | Next.js web app        |
| http://localhost:3001/v1 | Public HTTP API (Hono) |
| http://localhost:3002    | Worker health sidecar  |
| http://localhost:8025    | Mailpit (dev SMTP UI)  |

## Verification (clean-clone contract)

```bash
pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

must complete green on a fresh clone. CI enforces this on every PR.

## Contributing

- Conventional commits enforced (`feat(web): …`, `fix(api): …`, etc) — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- All PRs require green CI + `@diazdevivar365` review (see [`CODEOWNERS`](./CODEOWNERS)).
- Active work tracker: [`tasks/todo.md`](./tasks/todo.md).
- Post-mortem lessons: [`tasks/lessons.md`](./tasks/lessons.md).

## License

Proprietary — see [`LICENSE`](./LICENSE). All rights reserved © 2026 Forgentic.
