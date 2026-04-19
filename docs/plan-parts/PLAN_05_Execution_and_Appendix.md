## Section N — Sequenced Execution Plan (Workstreams)

This is **not** an MVP-then-improve plan. It is a logical execution sequence — each workstream lands fully done before dependents start. Workstreams within the same group can run in parallel by separate subagents.

### Group 0 — Foundations (must-finish before anything else)

**W0-1: Repo + tooling skeleton**

- Initialize `Synterra/` monorepo (pnpm + Turborepo)
- Configure TS strict, ESLint, Prettier, Vitest, Playwright
- GitHub Actions: lint + typecheck + test pipelines
- Pre-commit hook (`husky` or simpler) running typecheck + format
- Acceptance: `pnpm install && pnpm build && pnpm test` runs green on a clean clone.

**W0-2: Postgres setup + Drizzle scaffold**

- Define `packages/db/` with Drizzle config
- Write migrations 0001-0012 (all schemas in §B.2)
- Write `withWorkspaceContext` helper + `serviceRoleQuery` escape hatch
- Generate Drizzle types
- Acceptance: `pnpm db:migrate` applies cleanly to a fresh Postgres; integration test verifies RLS denies cross-workspace reads.

**W0-3: Infrastructure (LXC + Docker Compose + Cloudflare Tunnel)**

- Provision LXC `synterra.lan`
- Compose stack for Postgres + Redis + Cloudflare Tunnel
- Infisical project `synterra-dev` with placeholder secrets
- `deploy-synterra.sh` modeled on Aquila's
- Acceptance: a placeholder Next.js app deploys via the script, reachable at `dev.synterra.app` through Cloudflare.

**W0-4: Observability bootstrap**

- OpenTelemetry SDK initialized in Next.js + workers
- Pino logger config
- Prometheus `/metrics` endpoint
- Promtail + grafana-agent containers configured
- Test traces visible in existing Grafana
- Acceptance: a request to a stub endpoint produces a trace span in Grafana with `synterra.workspace_id` attribute.

### Group 1 — Identity (W0 done)

**W1-1: better-auth integration**

- `packages/auth/` with better-auth configured (Drizzle adapter, sessions table, providers: magic link, passkey, Google, GitHub)
- Email provider configured (Resend, dev mode = console)
- Sign-in / sign-up routes + UI (shadcn forms)
- Acceptance: full sign-up via magic link works on dev; session persists across restarts.

**W1-2: Multi-workspace JWT issuance + middleware**

- `synterra_workspace_jwt` cookie issuance on workspace switch
- Server middleware validates both cookies + sets `synterra.workspace_id` / `synterra.user_id` for the request DB context
- Workspace switcher UI (Cmd+K + top-left dropdown)
- Acceptance: switching workspace re-routes + RLS-scoped queries return only that workspace's data.

**W1-3: WorkOS adapter (gated to Scale plan, but built day 1)**

- `packages/auth/workos.ts` adapter
- Workspace setting "Enable SSO" admin UI
- Test SAML flow with a test IdP (Okta dev account)
- SCIM webhook handler creates/updates `users` + `workspace_members`
- Acceptance: configured workspace can sign in via SAML; SCIM provisioning round-trips.

### Group 2 — Workspace lifecycle (W1 done)

**W2-1: Workspace CRUD + memberships**

- Server Actions: `createWorkspace`, `updateWorkspaceSettings`, `inviteMember`, `acceptInvite`, `changeMemberRole`, `removeMember`, `transferOwnership`
- Settings → Members UI
- Settings → General UI
- All actions audit-logged
- Acceptance: full member lifecycle works end-to-end; permission boundary tests pass for all six roles.

**W2-2: Aquila org provisioning (depends on AQ-1 in Aquila)**

- `workspace-provisioner` BullMQ worker
- On `createWorkspace`: enqueues provisioning job → calls Aquila `POST /orgs` + `POST /orgs/{slug}/api-keys` → encrypts + stores in `aquila_credentials`
- Failure handling + retry
- Acceptance: a new workspace in Synterra produces a new `organizations` row + `org_api_keys` row in Aquila; Synterra holds encrypted credentials.

**W2-3: URL-first onboarding (the 90-second wow)**

- `/start` route with anonymous URL input
- Anonymous Aquila call to `synterra_anon` org with strict per-IP rate limit (Cloudflare Turnstile + Synterra middleware)
- `inflight_bootstrap` table tracking
- Email magic link sent
- Post-signup: claim inflight result + re-run pipeline against real workspace org with deeper depth
- Live progress streaming via Supabase Realtime
- Acceptance: full flow under 90s for the "show preview" moment; under 4 minutes for the deep enrichment.

**W2-4: Workspace switcher + multi-workspace UX**

- Cmd+K palette with workspace search
- Top-left workspace dropdown
- "Last visited page per workspace" persistence
- "Create new workspace" flow (gated by plan)
- Acceptance: agency user with 5 workspaces can switch between them and Cmd+K finds the right one in <300ms.

### Group 3 — Billing (W2 done)

**W3-1: Plans + Stripe integration**

- Seed `plans` table with 5 plans
- Stripe products + prices (per env)
- Subscription creation on signup (trial first)
- Webhook handler for `customer.subscription.{created,updated,deleted}`, `invoice.{created,paid,failed}`
- Customer portal link
- Acceptance: complete trial → upgrade → invoice → downgrade → cancel cycle works end-to-end in Stripe test mode.

**W3-2: Lago self-hosted deployment**

- Lago in compose stack
- Lago API key in Infisical
- Configure plans + meters in Lago to mirror Stripe
- Acceptance: Lago dashboard reachable; events ingested via REST appear in dashboard.

**W3-3: Usage aggregator + quota enforcement (depends on AQ-3)**

- `usage-aggregator` BullMQ scheduled job (every 60s)
- Pulls `GET /orgs/{slug}/usage` per active workspace; writes `usage_events` + updates `workspace_quotas`
- Forwards events to Lago with idempotency key
- `requireCredits` middleware in Server Actions
- In-app usage dashboard
- Acceptance: a research run consumed in Aquila appears in Synterra usage dashboard within 60s; quota check blocks at 100%.

### Group 4 — Core product surface (W2 done; runs parallel with W3)

**W4-1: Brand dashboard + DNA viewer**

- `/[workspace]/brands` list page (RSC, paginated)
- `/[workspace]/brands/[id]` brand detail with DNA panel, voice profile, top competitors snapshot
- Aquila API integration for read-only data
- Acceptance: a workspace with bootstrapped data sees their brand DNA on first login.

**W4-2: Competitor monitoring + change feed**

- `/[workspace]/brands/[id]/competitors` competitor cards
- `/[workspace]/brands/[id]/changes` chronological change feed
- Subscribe Aquila webhook `change_events` → `notification-dispatcher` → in-app notif + (subscribed users) email
- Acceptance: simulated change in Aquila produces a feed entry within 5s of webhook.

**W4-3: Research run UI (live + history)**

- `/[workspace]/research/new` form (URL or brand picker)
- `/[workspace]/research/[runId]` live progress (depends on AQ-2 SSE stream)
- `/[workspace]/research` history table
- Acceptance: triggering a run shows live progress; refresh resumes from current state.

**W4-4: AI generation surface**

- `/[workspace]/generate/brand-voice` form: paste copy → "rewrite in our voice"
- `/[workspace]/generate/battlecard`: pick competitor → generate competitive battlecard
- Calls Aquila `POST /v1/generate/*` (existing or new endpoints)
- Quota debit before generation
- Acceptance: 3 generation tools work end-to-end; usage reflected in dashboard.

### Group 5 — Notifications + retention (W3 + W4 done)

**W5-1: Notification engine**

- `notification-dispatcher` worker
- In-app inbox UI (Supabase Realtime)
- Subscriptions matrix UI
- Acceptance: triggering a synthetic event shows up in inbox + subscribed channels within 3s.

**W5-2: Email templates (React Email + Resend)**

- Templates: welcome, magic link, invite, weekly digest, change alert, quota warning, payment failed
- Acceptance: each template renders + sends in dev mode; preview UI in admin.

**W5-3: Weekly Brand Pulse digest**

- Scheduled BullMQ job per workspace (cron in workspace timezone)
- Aggregates last 7 days of changes + metrics into a digest email
- Acceptance: a workspace with activity gets a digest at the configured time.

**W5-4: Slack integration (Growth+)**

- Slack OAuth app
- "Connect Slack" flow per workspace
- Per-channel routing for events
- Acceptance: a workspace can install the app, pick a channel, see test event delivery.

### Group 6 — Public API + Webhooks (W4 done)

**W6-1: Public API key issuance UI**

- `/[workspace]/api-keys` UI to create + revoke
- Acceptance: created key authenticates against `GET /v1/workspaces/me`.

**W6-2: Public API surface (v1 endpoints)**

- Hono routes under `apps/api/src/routes/v1/*`
- Zod schemas + OpenAPI generation
- Per-key rate limit (Redis sliding window)
- Idempotency middleware
- Acceptance: every v1 endpoint has integration test; OpenAPI spec generates cleanly.

**W6-3: Outbound webhooks (customer-facing)**

- `webhook_endpoints` UI
- `webhook-dispatcher` worker
- Retry policy + dead-letter
- Acceptance: customer can subscribe to `change.detected`, see deliveries in dashboard, retry from UI.

**W6-4: SDK generation pipeline**

- OpenAPI → TypeScript SDK
- OpenAPI → Python SDK
- Publish to npm + PyPI on release
- Acceptance: SDK works against staging; example notebook runs end-to-end.

**W6-5: Public docs site**

- Mintlify or Nextra at `docs.synterra.app`
- Auto-rebuilds on OpenAPI change
- Cookbook authored (5 starter recipes)
- Acceptance: docs site live; "Try it" buttons work with user's key.

### Group 7 — Admin control plane (W3 done)

**W7-1: Admin app shell + auth**

- `apps/admin/` (or route group within web)
- Cloudflare Access integration (Google Workspace SSO)
- IP allowlist
- Acceptance: only allowed Google accounts from allowed IPs can reach `/admin/*`.

**W7-2: Workspace explorer + impersonation**

- Search/filter UI
- Impersonate flow: opens workspace as that user with banner; logged to audit
- Acceptance: support flow tested end-to-end.

**W7-3: Plan/billing operations**

- Manual upgrade/downgrade, refund, suspend, grant credits
- Acceptance: operator can resolve a billing dispute without touching DB directly.

**W7-4: Feature flags + ops dashboards**

- Per-workspace flags
- Embed Aquila + Synterra Grafana dashboards
- Acceptance: flag flip propagates within 30s via Redis pub/sub to running app instances.

### Group 8 — Compliance + Security hardening (run parallel from Group 3)

**W8-1: GDPR data export + delete**

- `POST /v1/workspaces/me/export` returns ZIP with all workspace data (CSV per table + JSON metadata)
- `DELETE /v1/workspaces/me` initiates 30-day soft delete cascading to Aquila org disable
- Acceptance: export validates against schema; delete marks workspace and schedules purge job.

**W8-2: Audit log surface**

- `/[workspace]/settings/security/audit` UI (Scale+ feature)
- Export to CSV/JSON
- Hash-chain verification command in CLI
- Acceptance: an admin can review last 90 days of changes; verify-chain command confirms integrity.

**W8-3: Cookie consent + legal pages**

- Cookiebot or self-hosted equivalent
- Privacy policy, ToS, DPA, sub-processor list pages (legal-reviewed copy)
- Acceptance: consent banner appears for EU IPs; legal pages reachable.

**W8-4: SOC 2 prep (Vanta onboarding)**

- Vanta integrations (GitHub, Cloudflare, Stripe, Postgres backup verification)
- Policies authored (incident response, access review, vendor mgmt)
- Vulnerability scanner in CI
- Acceptance: Vanta dashboard shows >85% control coverage.

**W8-5: Penetration test**

- Engage external firm
- Remediate findings before launch
- Acceptance: pen test report shows no high/critical unaddressed.

### Group 9 — Marketing + launch surface (parallel from Group 4)

**W9-1: Marketing site**

- `synterra.app/` landing, `/pricing`, `/(legal)/*`
- Metrics-instrumented (PostHog or self-hosted Plausible)
- Acceptance: landing page achieves <1.5s LCP on mobile.

**W9-2: Pricing + checkout**

- Pricing page with plan comparison
- Stripe Checkout integration for self-serve upgrade
- Acceptance: full self-serve trial → paid conversion works.

**W9-3: Help center / changelog**

- HelpScout or self-hosted help center (Outline?)
- `/changelog` route (Markdown-driven)
- Acceptance: support request from app routes to HelpScout inbox.

### Group 10 — Pre-launch hardening + launch

**W10-1: Load test**

- k6 scripts simulating 1k concurrent users across 100 workspaces
- Bottleneck remediation
- Acceptance: p99 < 500ms at target load; no DB connection exhaustion.

**W10-2: Onboarding optimization**

- A/B test variants of `/start` flow
- Track funnel; iterate copy + design
- Acceptance: ≥40% URL-submission → signup-completion conversion.

**W10-3: Customer migration tooling (the 1 existing tenant: OmeletStudio)**

- Script to import OmeletStudio's existing Aquila org into Synterra (create workspace, link credentials, backfill members)
- Acceptance: OmeletStudio team uses Synterra UI on top of their existing Aquila data without disruption.

**W10-4: Public launch**

- Press: ProductHunt, Hacker News Show HN, X thread, LinkedIn post
- Coordinated with status page, capacity reserved, on-call rotation defined
- Acceptance: 24h post-launch, no p1 incidents; signup conversion within target.

---

## Section O — Subagent Team for Synterra

Mirroring Aquila's `.claude/agents/` pattern, Synterra needs its own specialized team:

| Agent                          | Model  | Role                                                 |
| ------------------------------ | ------ | ---------------------------------------------------- |
| `synterra-architect`           | opus   | System design, RLS reviews, cross-cutting concerns   |
| `synterra-orchestrator`        | opus   | Cross-agent briefing; reads `_memory/` of all others |
| `synterra-frontend-engineer`   | sonnet | Next.js App Router, RSC, shadcn, TanStack Query      |
| `synterra-backend-engineer`    | sonnet | Server Actions, Hono, Drizzle, BullMQ                |
| `synterra-auth-engineer`       | sonnet | better-auth, WorkOS, JWT issuance, RBAC              |
| `synterra-billing-engineer`    | sonnet | Stripe, Lago, metering, quota enforcement            |
| `synterra-aquila-bridge`       | sonnet | Aquila client, JWT exchange, integration contracts   |
| `synterra-test-writer`         | sonnet | Playwright E2E, Testcontainers integration tests     |
| `synterra-security-compliance` | sonnet | Read-only — RLS audit, secret leaks, GDPR/SOC2 prep  |
| `synterra-doc-keeper`          | haiku  | Keeps `docs/` aligned + customer-facing API docs     |

These are scaffolded as part of W0-1.

---

## Section P — Risks & Non-Goals

### P.1 Risks (top 8) and mitigations

| Risk                                                | Likelihood | Impact   | Mitigation                                                                                                                                    |
| --------------------------------------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant data leak via RLS misconfig            | Med        | Critical | Automated test enforces every endpoint scopes by workspace; quarterly external review                                                         |
| Aquila instability blocks Synterra                  | Med        | High     | Circuit breaker; degraded mode (read cached data); status banner                                                                              |
| Stripe + Lago drift causing wrong invoices          | Low        | High     | Reconciliation job alerts >0.5% drift; manual review workflow                                                                                 |
| URL-first onboarding abused for SSRF/spam scrape    | Med        | Med      | Cloudflare Turnstile + per-IP rate limit + Aquila SSRF guard inherited                                                                        |
| Self-hosted infrastructure outage (single LXC host) | Low        | Critical | DR runbook, B2 offsite, target RTO 30min; HA Proxmox cluster within 12mo                                                                      |
| Vendor (better-auth, WorkOS, Resend) outage         | Low        | High     | better-auth self-hosted (no provider down); Resend has 99.9% SLA + Postmark fallback documented; WorkOS only blocks SAML logins               |
| Slow growth — runway pressure forces cut-corners    | Med        | High     | Plan is sequenced; no workstream depends on later workstreams cosmetically; can pause at any group boundary without leaving system half-built |
| LLM provider price hike eating margin               | Med        | Med      | Cost-per-credit reviewed monthly; rate card adjustable; multi-provider routing already in Aquila                                              |

### P.2 Explicit non-goals (v1)

- **Mobile app**: web is responsive; native mobile is post-launch decision.
- **Offline mode**: not required.
- **End-user-facing collab editor (Notion-style)**: defer to v2 (Liveblocks + Yjs path documented; not built).
- **In-product chat / community**: use Discord/Slack externally for v1.
- **Marketplace of integrations** (Zapier-style): publish webhooks + API; let customers self-build for v1.
- **Custom on-prem deploy for enterprise**: dedicated tenancy = separate DB only, not separate infra. Re-evaluate if a $250K+ customer asks.
- **Multi-region failover**: single-region for v1; Cloudflare handles edge proximity.
- **Observability for end-customers (their own dashboards)**: defer; show usage + invoice for v1.

---

## Section Q — Decisions (CLOSED 2026-04-19)

All five originally-open decisions resolved by user the same day the plan was approved. Authoritative answers live in the **DECISIONS RESOLVED** block at the top of this document. Mirror summary here for quick reference:

| #   | Decision                     | Resolution                                                                                                                                                                                                              |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hosting model                | All self-hosted on LXC; 9-LXC topology with HA primitives (DB replica + Redis Sentinel + Traefik LB). See Section M revised.                                                                                            |
| 2   | Pricing currency             | USD base; ARS conversion at presentation layer using daily FX rate. Stripe charges USD.                                                                                                                                 |
| 3   | Branding & domain            | Public brand = **Forgentic**, domain = **`forgentic.io`** (Namecheap registrar, Cloudflare nameservers). "Synterra" = internal codename, never customer-visible. See "Naming Strategy" + "DNS Strategy" near top.       |
| 4   | Trial CC requirement         | No CC required at trial; controlled by `TRIAL_REQUIRES_CC` flag in Infisical for easy flip.                                                                                                                             |
| 5   | Aquila usage endpoint (AQ-3) | Build AQ-3 in Aquila + run billing engine (Lago) and observability stack in dedicated separate LXCs (`metering.lan`, `observability.lan`) so future "vertical Aquilas" plug into one shared metering+telemetry surface. |

**No open decisions remaining.** W0-1 can start as soon as the user gives the go-ahead.

### Newly-noted Aquila-side change (added with topology revision)

**AQ-4 (NEW): Migrate Aquila telemetry stack to `observability.lan`**

- Today Aquila runs Prometheus + Loki + Grafana inside `aquila.lan`. As Forgentic + future vertical Aquilas come online, they all need a shared observability target.
- Action: stand up `observability.lan` with Prometheus/Loki/Tempo/Grafana; reconfigure Aquila promtail/grafana-agent to ship to it; decommission Aquila's local stack; preserve dashboards via export/import.
- Filed as a new entry in `Aquila/tasks/todo.md` alongside AQ-1, AQ-2, AQ-3.
- Not blocking Forgentic (Forgentic ships its own promtail/grafana-agent pointing at `observability.lan` from day 1); only blocks Aquila telemetry consolidation.

---

## Verification — How To Know Synterra Is Done (per workstream)

Each workstream has acceptance criteria above. The aggregate launch-ready bar is:

1. **Onboarding funnel:** 100 synthetic signups → ≥80 reach "ready" workspace state in ≤5 min; ≥40 invite a teammate.
2. **Cross-tenant isolation:** automated test suite asserts every API endpoint blocks cross-workspace access (>200 test cases generated from the route table).
3. **Billing correctness:** 1000 simulated metered events match Stripe invoice within $0.01.
4. **Performance:** p99 latency <500ms at 1000 concurrent users across 100 workspaces (k6 load test).
5. **Security:** external pen test report clean of high/critical issues.
6. **Compliance:** Vanta SOC 2 control coverage ≥85%; GDPR export + delete flows tested with real EU test workspace.
7. **Customer migration:** OmeletStudio (the existing Aquila tenant) has been migrated into Synterra and uses it as their primary workspace UI for ≥30 days with zero data complaints.
8. **Documentation:** every customer-facing capability has both an in-app help link and a docs page; OpenAPI covers 100% of public endpoints.

Hit all 8 → Synterra v1 is launch-ready.

---

## Appendix A — Critical Aquila Files Referenced

For implementers working in `Synterra/`, these are the **read-only** Aquila files you'll need to understand to build the integration layer:

- `Aquila/Backend/services/api/app/deps/auth.py` — `Caller`, `require_user`, `require_org`, `require_admin`, `require_tenant` (lines 33-149) — the auth dependencies your `aquila-client` will satisfy
- `Aquila/Backend/services/api/app/routers/orgs.py` — `POST /orgs`, `POST /orgs/{slug}/api-keys`, etc. (lines 96-498) — what Synterra calls during workspace provisioning
- `Aquila/Backend/services/api/app/routers/research.py` — `POST /research`, `GET /research/{run_id}` (the workhorse endpoint)
- `Aquila/Backend/services/api/app/routers/auth.py` — `User` model, `get_current_active_admin` — used by orgs router
- `Aquila/Backend/security/api_keys.py` — `generate_api_key()`, key hashing scheme — informs Synterra's symmetric implementation
- `Aquila/Backend/infra/migrations/0006_orgs.sql` — the `organizations` + `org_api_keys` schema Synterra writes to via the API
- `Aquila/Backend/shared/lib/webhooks.py` — `dispatch()` function — pattern Synterra mirrors for outbound webhook delivery
- `Aquila/docs/omelet_granular_api.md` — the existing public API contract (Synterra v1 API is its evolution)
- `Aquila/docs/ARCHITECTURE.md` — Aquila architecture overview
- `Aquila/tasks/todo.md` — where AQ-1, AQ-2, AQ-3 land

---

## Appendix B — Memory & Lessons Imports

When starting Synterra implementation, the orchestrator should mirror these Aquila lessons into Synterra's `tasks/lessons.md`:

1. **Cero hardcoding** of IPs, hostnames, model names, providers — env-only.
2. **Antes de inventar, mirar cómo lo hizo Omelet** — Synterra inherits patterns from Omelet (SMTP delivery wrapper, Qdrant hybrid search, LLM provider routing) instead of reinventing.
3. **Infisical es source of truth** for variables.
4. **Build → Test → SaaS** ordering — this plan IS the SaaS phase, but each workstream still ships with its own tests, not as a deferred concern.
5. **Vigilar tamaño de archivos** — every Synterra source file >400 LOC requires a split rationale; every doc >800 LOC splits into sub-docs.

These imports become Synterra `tasks/lessons.md` entries 1-5 on day 1.

---

**End of plan.**

After approval, this file will be copied to `/home/diazdevivar/Projects/Forgentic/Synterra/PLAN.md`, `/home/diazdevivar/Projects/Forgentic/Synterra/docs/ARCHITECTURE.md` will be seeded from sections A-M, and the AQ-1/AQ-2/AQ-3 entries will be added to `/home/diazdevivar/Projects/Forgentic/Aquila/tasks/todo.md`.
