# Architecture

Forgentic (codename **Synterra**) is the customer-facing SaaS control plane for brand intelligence. It owns
every surface a tenant touches — signup, workspaces, authentication, billing, API keys, audit trail,
notifications, and the public REST/Webhook API. Aquila is the data plane: it runs research jobs, holds the
brand-intelligence graph in Neo4j, and executes the long-tail worker fleet. The two planes communicate
over a versioned HTTPS contract with JWT service-to-service auth; no customer ever hits Aquila directly.
See [`PLAN.md §E`](../PLAN.md) (Aquila integration contract) for the authoritative wire format.

The control plane runs on **Node 22** across three workspaces: `apps/web` (Next.js 16 with React Server
Components + Turbopack), `apps/api` (Hono on `@hono/node-server`), and `apps/workers` (BullMQ consumers
backed by Redis). State lives in **Postgres 16** with strict row-level security enforcing tenant
isolation at the database layer — the application-level `orgId` filter is defence-in-depth, not the
primary gate. Drizzle owns the schema; migrations ship from `packages/db/drizzle/`. Shared code — Zod
schemas, the typed Aquila client, React Email templates, the shadcn component library, the OpenTelemetry
bootstrap, the better-auth wrapper, and the billing plan matrix — lives under `packages/*` as workspace
packages consumed across the three apps. See [`PLAN.md §A`](../PLAN.md) (North-Star Architecture) and
[`PLAN.md §B.1`](../PLAN.md) (tenancy strategy) for the full dependency graph and data model.

Environments stage in two phases. **Phase 0** runs on Proxmox LXCs on our own metal: one container each
for Postgres, Redis, the three Node apps, Grafana/Loki/Tempo, Mailpit/Postfix, and a Cloudflare Tunnel
edge. That gives us a production surface cheap enough to dogfood with real customers while the product
surface stabilises. **Phase 1** lifts the same Docker images onto **AWS ECS Fargate** behind an ALB, with
RDS for Postgres and ElastiCache for Redis; the workload definitions are portable by design (no
LXC-specific assumptions leak into the app code). The phase cutover is gated on customer scale, not
calendar — see [`PLAN.md §M`](../PLAN.md) for the container topology and the Phase 0/1 delta.

All cross-plane calls are pinned to a **contract version** (`2026-04` today); Aquila rejects mismatches
at the ingress layer so a rogue deploy can't quietly corrupt tenant state. The Synterra-side client
(`packages/aquila-client`) enforces the same pin on construction. When the contract bumps, both sides
ship together — see [`PLAN.md §E.1`](../PLAN.md) for the change-management protocol.
