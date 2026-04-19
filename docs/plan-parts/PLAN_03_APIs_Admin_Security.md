## Section G — Notifications & Retention Engine

### G.1 The retention thesis

Jasper retains because users come back weekly to write campaigns. **Synterra retains because the world keeps changing and Synterra is the only place that knows when your competitors moved.**

Retention loops:

1. **Weekly Brand Pulse digest** (every Monday 8am workspace timezone): "3 competitors made changes this week, here's what."
2. **Real-time change alerts**: competitor posts new pricing → in-app notification + optional email/Slack.
3. **Suggested next actions**: "Your competitor just changed positioning — generate a counter-positioning brief?" (one-click, uses Aquila pipeline).
4. **AI-prepared drafts ready Monday**: pre-generated content suggestions waiting in inbox each week.
5. **Trend reports**: monthly automated industry trend report (from Aquila news/social workers).

### G.2 Channels

| Channel          | Use cases                                | Implementation                                              |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------- |
| **In-app**       | All events; the inbox is the central UI  | Supabase Realtime subscription on `notification_deliveries` |
| **Email**        | Weekly digest, important alerts, billing | Resend + React Email templates                              |
| **Slack**        | Real-time alerts for active workspaces   | Slack OAuth app (Growth+ feature)                           |
| **Webhook**      | Customer-defined HTTP endpoints          | Internal `webhook-dispatcher` BullMQ worker (Section H)     |
| **SMS** (future) | Critical-only, opt-in                    | Twilio (post-launch decision)                               |

### G.3 User preferences

Each user × workspace × event_type × channel has a row in `notification_subscriptions` (default ON for in-app, OFF for email/slack/webhook unless opted in). Settings → Notifications shows a matrix UI to manage.

### G.4 Engine

- **Event sources:** Aquila webhooks (change events, research complete) + Synterra-internal events (member invited, plan changed, quota reached).
- **Dispatcher:** BullMQ `notification-dispatcher` worker fans out events to subscribed channels.
- **Aggregation:** "Brand Pulse" weekly digest is a separate BullMQ scheduled job (cron `0 8 * * 1` per workspace timezone).
- **Delivery tracking:** every send creates a `notification_deliveries` row; bounce/failure handling for email triggers retry then disable.

---

## Section H — Public API, Webhooks, SDK

### H.1 Public REST API

Synterra exposes `https://api.synterra.app/v1/*` for customers to integrate.

**Auth:** `Authorization: Bearer sntr_<env>_<rand>` — keys created in workspace UI, scoped, expirable.
**Rate limit:** per workspace (1000 req/min Growth, 5000 req/min Scale).
**Idempotency:** all POST/PATCH/PUT accept `Idempotency-Key` header (stored 24h in Redis).
**Error format:** RFC-7807 problem+json.
**Versioning:** URL-based `/v1/`; minor versions are backward compatible; breaking changes require `/v2/`.

**v1 endpoints (initial surface — kept tight, opinionated):**

| Endpoint                                 | Purpose                                  |
| ---------------------------------------- | ---------------------------------------- |
| `GET /v1/workspaces/me`                  | current workspace metadata               |
| `GET /v1/brands`                         | list workspace's brands                  |
| `GET /v1/brands/{id}`                    | brand snapshot (DNA, voice, competitors) |
| `POST /v1/research`                      | trigger research run on a URL            |
| `GET /v1/research/{run_id}`              | poll status                              |
| `GET /v1/research/{run_id}/stream` (SSE) | live progress                            |
| `GET /v1/competitors`                    | list tracked competitors                 |
| `GET /v1/changes?since=...`              | competitor changes feed                  |
| `POST /v1/generate/brand-voice`          | LLM generation in workspace's voice      |
| `GET /v1/usage`                          | current period quota + consumption       |
| `POST /v1/webhooks` / `GET` / `DELETE`   | manage webhook endpoints                 |

### H.2 Webhooks (outbound from Synterra to customer)

- HMAC-SHA256 signed (`X-Synterra-Signature: t=<timestamp>,v1=<hmac>`).
- 10s timeout, 8 retries with exponential backoff over 24h.
- Replay protection: 5-minute timestamp window.
- Customer can mark a delivery "manually retried" from the dashboard.
- `webhook_deliveries` table is the durable log; UI shows recent deliveries with payload + response.

### H.3 SDKs

- **TypeScript** (`@synterra/node`) — published to npm, generated from OpenAPI spec.
- **Python** (`synterra-py`) — published to PyPI, same generation.
- **CLI** (`synterra` binary) — wraps the TS SDK, useful for ops + agency scripts.

OpenAPI spec generated from Hono route handlers via `@hono/zod-openapi`. Publishing pipeline regenerates SDKs on every API change in CI.

### H.4 Public docs

- `docs.synterra.app` — Mintlify-hosted (or Nextra; decide at scaffold time), auto-rebuilt on OpenAPI change.
- Cookbook section: "How to embed brand DNA in your CMS", "Auto-generate weekly competitor reports", etc.
- Live API explorer (Try It buttons) using user's workspace key.

---

## Section I — Admin / Internal Control Plane

### I.1 The internal admin app

`admin.synterra.app` — separate Next.js route group, behind Cloudflare Access (Zero Trust SSO via Google Workspace) + IP allowlist (office + Tailscale).

Capabilities:

- **Workspace explorer**: search, filter by plan/status/created date/usage; deep-link into any workspace.
- **Impersonation**: 1-click "Sign in as workspace owner" (logs `audit_log` rows, banner in workspace UI: "You are being viewed by Synterra Support — Gonzalo Diaz").
- **Plan changes**: manually upgrade/downgrade, grant credits, override quotas.
- **Refunds**: trigger Stripe refund + dunning suppression.
- **Suspension**: per-workspace; reason captured; banner shown to all members.
- **Feature flags**: per-workspace boolean flags (early-access, custom features).
- **Usage attribution**: dashboards showing top spenders, margin per workspace, cost per LLM call.
- **Aquila health**: Aquila API up/down, queue depth, worker health (mirrored from Aquila's Grafana).
- **Support**: customer comms timeline (linked to Linear/HelpScout if integrated).
- **Migration tools**: export workspace data, move to dedicated DB, run data fixes.

### I.2 Why a separate app

- Strict access (no customer-shared routes).
- Different auth (admin-only Google SSO via Cloudflare Access).
- Different RLS context (uses service role; every action audited).
- Can be ugly/dense — built for ops speed, not customer polish.

---

## Section J — Security & Compliance

### J.1 Threat model (top risks, mitigations)

| Threat                                            | Mitigation                                                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant data leak (the #1 SaaS lawsuit risk) | RLS at Postgres + workspace context middleware + automated test suite verifying every endpoint enforces workspace scope            |
| Stolen browser session                            | Short-lived workspace JWT (15min), HTTP-only cookies, IP-binding for Scale plan, session revocation UI                             |
| Stripe webhook spoofing                           | Signature verification; webhook secret per env in Infisical                                                                        |
| Synterra → Aquila token leak                      | Per-workspace API keys (not master token), 60s JWT exchange, automatic rotation every 90 days                                      |
| Customer-uploaded SSRF                            | URL validation via Aquila's existing `is_ssrf_safe()`; never let user input reach our internal network                             |
| Mass account creation (signup abuse)              | Cloudflare Turnstile on signup form; per-IP rate limit; email verification mandatory before any Aquila call                        |
| LLM prompt injection (in scraped content)         | Aquila already wraps scraped content in `<scraped_content>` tags + system prompt instructions (existing C5 fix); Synterra inherits |
| Public API key leak                               | Prefix-visible, full-key shown once; periodic scanner detects keys in public GitHub via GitGuardian-equivalent                     |
| Insider threat (internal admin)                   | All admin actions audited; periodic admin-action review; least-privilege admin roles                                               |

### J.2 Encryption

- **In transit:** TLS 1.3 everywhere (Cloudflare-terminated; origin via Cloudflare Tunnel).
- **At rest:** Postgres TDE not used (premium feature) — instead, application-layer envelope encryption for sensitive columns (`aquila_credentials.api_key_secret_enc`, `webhook_endpoints.secret`, `notification_subscriptions.config` for slack tokens). KMS root key in Infisical, data keys cached.
- **Backups:** Postgres nightly dump → Backblaze B2 (encrypted client-side with `age`).

### J.3 Compliance roadmap

- **Day 1:**
  - GDPR-ready: DPA template, sub-processor list page, data export endpoint (`POST /v1/workspaces/me/export` returns ZIP), delete-my-data endpoint (cascade delete, 30-day grace).
  - Cookie consent banner (Cookiebot or self-hosted equivalent).
  - Privacy policy + Terms of Service drafted by legal.
- **Month 3:**
  - Vanta or Drata onboarded; SOC 2 Type II audit window opens.
  - Vulnerability scanning in CI (Snyk or Trivy).
  - Annual penetration test commissioned.
- **Month 12:**
  - SOC 2 Type II report available.
  - HIPAA evaluation (only if healthcare customers ask).

### J.4 Audit log integrity

- Append-only (no UPDATE/DELETE permitted by DB role).
- Hash chain every 1000 rows (each row's hash includes previous row's hash) — tampering detectable.
- Daily off-site replication.

---

## Section K — Observability

### K.1 Stack

Synterra plugs into **the same** Prometheus + Loki + Grafana that Aquila already runs. No new vendor.

- **Logs:** Pino (Node) → JSON stdout → Promtail → Loki, with `trace_id` and `workspace_id` on every line.
- **Metrics:** OpenTelemetry SDK → Prometheus `/metrics` endpoint → Prometheus scrape.
- **Traces:** OTLP HTTP exporter → Tempo (added to existing stack) → Grafana trace view.

Every span has these attributes:

- `synterra.workspace_id`
- `synterra.user_id` (when applicable)
- `synterra.plan_id`
- `synterra.action` (e.g., `research.submit`, `billing.subscription.update`)
- `aquila.org_slug` (when crossing into Aquila)

### K.2 Dashboards (in Grafana, infrastructure-as-code via JSON)

1. **System health**: API latency p50/p99, error rate, queue depth, DB connection pool saturation.
2. **Per-workspace usage**: top 20 workspaces by credit consumption, cost-to-revenue ratio.
3. **Onboarding funnel**: signup → email click → workspace created → first action → invite sent → upgraded.
4. **Billing health**: MRR, churn, expansion, dunning.
5. **Aquila integration**: per-endpoint latency, circuit-breaker opens, JWT exchange rate.
6. **Notification delivery**: send rate per channel, bounce rate, webhook failure rate per endpoint.

### K.3 Alerting

Grafana Alerting → SMTP (using the Aquila SMTP path being built per `Aquila/tasks/todo.md`) + PagerDuty (paid for the on-call team — the user). Rules:

- `error_rate > 1% for 5min` → page
- `aquila_circuit_breaker_open > 30s` → page
- `db_connections_used > 80%` → warn
- `bullmq_queue_depth > 5000` → warn
- `webhook_delivery_failure_rate > 10%` → warn
- `subscription_failed_payment` → notify (no page)

---
