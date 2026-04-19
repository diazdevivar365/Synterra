# Synterra Subagent Team

Ten project-scoped Claude Code subagents that collaborate on the Synterra multi-tenant SaaS control plane (Next.js 16 + Drizzle/Postgres 16 RLS + Hono + BullMQ + better-auth + Stripe/Lago + OpenTelemetry + Vitest/Playwright/Testcontainers). Modeled on the Aquila team in `Aquila/.claude/agents/`.

## Agents

- **synterra-architect** — owns `PLAN.md`, tenancy invariants, and ADRs under `docs/ADR/`. Use when adding a cross-cutting decision, touching `workspace_id` semantics, or reviewing control-plane vs data-plane separation.
- **synterra-orchestrator** — cross-agent chief-of-staff. Use at session start, before dispatching multi-agent work, or to produce a unified project-health briefing.
- **synterra-backend-engineer** — owns `apps/api/`, `apps/workers/`, `packages/db/`, `packages/shared/`. Use for Drizzle schema, Hono routes, Server Actions, BullMQ workers, and RLS-safe queries.
- **synterra-frontend-engineer** — owns `apps/web/` and `packages/ui/`. Use for Next.js 16 App Router work, React 19 RSC, Tailwind v4, TanStack Query, shadcn primitives, and accessibility (WCAG 2.2 AA).
- **synterra-auth-engineer** — owns `packages/auth/`, `apps/web/src/app/(auth)/`, and API auth middleware. Use for better-auth config, WorkOS SSO, AQ-1 JWT exchange for Aquila, session rotation, and RBAC.
- **synterra-billing-engineer** — owns `packages/billing/`, Stripe/Lago glue, webhook handlers, and quota middleware. Use when wiring subscription flows, usage events, invoice reconciliation, or quota enforcement.
- **synterra-aquila-bridge** — owns `packages/aquila-client/` and every call to Aquila. Use when wiring AQ-1 (JWT exchange), AQ-2 (SSE streaming), AQ-3 (usage aggregation), or adding retries / circuit breaking to the bridge.
- **synterra-test-writer** — owns every `*.test.ts(x)`, `tests/e2e/`, and Testcontainers setup. Use after a feature lands, when coverage is missing, or to add RLS cross-workspace-denial, quota, and webhook-idempotency tests.
- **synterra-security-compliance** — read-only reviewer (writes only to `docs/security-reviews/`). Use after any change to scan RLS policies, secret handling, rate limits, audit trail, GDPR flows, and SOC2 prep items.
- **synterra-doc-keeper** — owns `docs/` and every `README.md`. Use when schema / routes / billing plans drift and the canonical docs + OpenAPI spec need regeneration.

## Memory

Every agent has a persistent cross-session scratchpad at `Synterra/.claude/agents/_memory/<agent>.md` (no `synterra-` prefix on the filename, because the directory already scopes it). Agents are instructed to:

1. **Read the whole memory file** at the start of every invocation so they remember what they already tried and what patterns were confirmed.
2. **Append a dated entry** (`## 2026-MM-DD - <title>`) after every non-trivial task, capturing decisions, gotchas, and open follow-ups.

The orchestrator reads every agent's memory before it produces a briefing, so memory is the cross-agent coordination channel.

## Settings

`Synterra/.claude/settings.json` denies reads of any `.env*` file and blocks destructive bash patterns. Install-level commands (`pnpm install`, force pushes) are blocked; grant them case-by-case with `/permissions`.
