# billing-engineer memory

_Persistent cross-session scratchpad for the `synterra-billing-engineer` subagent._
_Append a dated entry (`## 2026-MM-DD — <title>`) after every non-trivial task._
_Read the whole file at the start of every session._

---

## 2026-04-20 — W3-3: Usage aggregator + quota enforcement

**Lago client:** `packages/billing/src/lago/client.ts` + `types.ts`. Uses `GET /api/v1/customers/:id/current_usage` (Lago v1.32 endpoint name). Auth: `Authorization: Bearer LAGO_API_KEY`. Self-hosted at `metering.lan:3000` (default in workers `config.ts`).

**Quota tables:** `workspace_quotas` (schema at `packages/db/src/schemas/quota.ts`). `creditsGranted = -1` = enterprise/unlimited. Soft limit = 80%, hard = 100%.

**`consumeCredits`:** Always wraps its own `db.transaction()`. SELECT…FOR UPDATE on `workspace_quotas`, INSERT `usage_events`, UPDATE quota row — all in one tx. Duplicate idempotency key (pg `23505`) caught and returns `reason: 'duplicate_event'` without double-debit.

**`seedWorkspaceQuota`:** Called from inside `serviceRoleQuery` in `stripe-worker.ts` — does NOT open its own tx. Uses `INSERT ... ON CONFLICT (workspace_id) DO UPDATE` resetting `creditsConsumed=0` on every call. Risk: spurious Stripe webhooks zero mid-period usage.

**Stripe-worker quota seeding:** `seedWorkspaceQuota(tx, ...)` is called inside the same `serviceRoleQuery` as the subscription upsert for `customer.subscription.created/updated`.

**Stripe API version:** pinned to `2025-02-24.acacia` (stripe@17.7.0 requirement).

**Migration 0017:** `packages/db/migrations/0017_seed_existing_quotas.sql` — backfills `workspace_quotas` for active subscriptions using `plans.quotas->>'monthly_credits'` (snake_case in DB JSON).

**AQ-3 stub:** Aggregator logs `usage_aggregator.aquila_polling_skipped` at startup. Lago reconciliation runs every 60s; Aquila polling deferred until AQ-3 lands.

**Workers docker-compose:** Added `STRIPE_SECRET_KEY`, `LAGO_API_URL`, `LAGO_API_KEY` to workers env block; `LAGO_API_KEY` added to `REQUIRED_VARS` in `deploy-synterra.sh`.
