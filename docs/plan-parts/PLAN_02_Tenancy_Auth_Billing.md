## Section B — Tenancy & Data Model

### B.1 Tenancy strategy

**Decision:** **Shared schema + Postgres Row-Level Security (RLS), in a brand-new `synterra` Postgres 16 database** — _separate_ from Aquila's `aquila` database. Both DBs run on the same Postgres instance (or two instances if scale demands later) but have no FKs between them. The contract is the `workspace.aquila_org_slug` value, which Synterra writes into Aquila's `organizations.slug`.

**Why separate databases:**

- **Blast radius:** a Synterra schema migration cannot break Aquila's data plane.
- **Backup independence:** Aquila keeps its existing PITR + nightly dump cadence; Synterra adds its own.
- **Permissioning:** the `synterra` DB role has no read access to `aquila` tables. If the Synterra app is compromised, Aquila customer data is not directly exposed (defense in depth).
- **Future portability:** if Synterra needs to move to managed Postgres (Neon, Supabase) for scaling and Aquila stays self-hosted, the separation pre-enables that.

**Why shared schema + RLS (vs schema-per-tenant or DB-per-tenant):**

- Scales cleanly to **10K-100K workspaces** (the realistic SMB SaaS curve for years 1-3).
- RLS in Postgres 16+ is mature, planner cost issues are well-understood, fixes are documented.
- Migration story to dedicated DB for enterprise customers is straightforward (export workspace as SQL by `workspace_id`, restore into dedicated DB, switch routing).
- Single connection pool, single migration path, single ops surface.

**Hybrid escape hatch (planned, not built v1):** the `workspaces` table has a `db_routing_key` column (default `'shared'`). A future `workspace-router` package consults this on connection acquisition. Enterprise customers who buy "Dedicated Tenancy" addon get `db_routing_key = 'dedicated_<id>'` and a separate Postgres. Code path exists from day 1 (always-shared returns); switch flips the routing.

### B.2 Synterra Postgres schema (core entities)

All migrations in `packages/db/migrations/` using `drizzle-kit`. Every table is RLS-enabled.

#### Core identity

```sql
-- 0001_users.sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    email_verified  TIMESTAMPTZ,
    name            TEXT,
    avatar_url      TEXT,
    locale          TEXT DEFAULT 'en',
    last_login_at   TIMESTAMPTZ,
    is_suspended    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- users is NOT row-restricted — a user can always read their own record;
-- visibility of other users is gated by workspace_members membership.
```

#### Workspaces (= tenants)

```sql
-- 0002_workspaces.sql
CREATE TABLE workspaces (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug               VARCHAR(80) UNIQUE NOT NULL,  -- URL slug, also = aquila_org_slug
    name               TEXT NOT NULL,
    aquila_org_slug    VARCHAR(80) UNIQUE NOT NULL,  -- FK contract with Aquila.organizations.slug
    plan_id            VARCHAR(40) NOT NULL DEFAULT 'trial',  -- references plans table
    plan_status        VARCHAR(40) NOT NULL DEFAULT 'trialing',
    trial_ends_at      TIMESTAMPTZ,
    db_routing_key     VARCHAR(80) NOT NULL DEFAULT 'shared',
    settings           JSONB NOT NULL DEFAULT '{}'::jsonb,
    branding           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- logo, colors, custom domain
    bootstrap_url      TEXT,         -- the company URL given at signup
    bootstrap_state    VARCHAR(40) NOT NULL DEFAULT 'pending', -- pending|running|ready|failed
    suspended_at       TIMESTAMPTZ,
    suspension_reason  TEXT,
    deleted_at         TIMESTAMPTZ,  -- soft delete; hard purge after retention window
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_workspaces_plan        ON workspaces(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_workspaces_active      ON workspaces(id) WHERE deleted_at IS NULL AND suspended_at IS NULL;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspaces_member_read ON workspaces FOR SELECT
  USING (id = current_setting('synterra.workspace_id', true)::UUID
         OR EXISTS (SELECT 1 FROM workspace_members
                     WHERE workspace_id = workspaces.id
                       AND user_id = current_setting('synterra.user_id', true)::UUID));
CREATE POLICY workspaces_owner_write ON workspaces FOR UPDATE
  USING (id = current_setting('synterra.workspace_id', true)::UUID
         AND EXISTS (SELECT 1 FROM workspace_members
                      WHERE workspace_id = workspaces.id
                        AND user_id = current_setting('synterra.user_id', true)::UUID
                        AND role IN ('owner', 'admin')));
```

#### Memberships (M:N users ↔ workspaces — the **single biggest improvement over Aquila's flat `users.org_id`**)

```sql
-- 0003_memberships.sql
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'manager', 'editor', 'viewer', 'guest');

CREATE TABLE workspace_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            workspace_role NOT NULL DEFAULT 'editor',
    invited_by      UUID REFERENCES users(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ,
    is_disabled     BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (workspace_id, user_id)
);
CREATE INDEX ix_members_user ON workspace_members(user_id) WHERE NOT is_disabled;
CREATE INDEX ix_members_ws   ON workspace_members(workspace_id) WHERE NOT is_disabled;

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_self_view ON workspace_members FOR SELECT
  USING (user_id = current_setting('synterra.user_id', true)::UUID
         OR workspace_id = current_setting('synterra.workspace_id', true)::UUID);
CREATE POLICY members_admin_write ON workspace_members FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID
         AND EXISTS (SELECT 1 FROM workspace_members m
                      WHERE m.workspace_id = workspace_members.workspace_id
                        AND m.user_id = current_setting('synterra.user_id', true)::UUID
                        AND m.role IN ('owner', 'admin')));
```

#### Invitations

```sql
-- 0004_invites.sql
CREATE TABLE invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email           CITEXT NOT NULL,
    role            workspace_role NOT NULL DEFAULT 'editor',
    invited_by      UUID NOT NULL REFERENCES users(id),
    token_hash      TEXT NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, email) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY invites_workspace_visible ON invites FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Aquila bridge (per-workspace credentials Synterra holds for Aquila)

```sql
-- 0005_aquila_credentials.sql
-- One row per workspace. Plaintext API key NEVER stored — only the Aquila-issued
-- prefix + the encrypted secret (envelope-encrypted with KMS key from Infisical).
CREATE TABLE aquila_credentials (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_id          UUID NOT NULL,        -- Aquila's org_api_keys.id
    api_key_prefix      VARCHAR(16) NOT NULL,
    api_key_secret_enc  BYTEA NOT NULL,       -- envelope-encrypted secret
    scopes              TEXT[] NOT NULL DEFAULT '{*}',
    last_rotated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE aquila_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY aquila_creds_workspace ON aquila_credentials FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Billing

```sql
-- 0006_billing.sql
CREATE TABLE plans (
    id                   VARCHAR(40) PRIMARY KEY,   -- 'starter', 'growth', 'scale', 'enterprise'
    name                 TEXT NOT NULL,
    description          TEXT,
    stripe_product_id    TEXT NOT NULL,
    stripe_price_id_seat TEXT,        -- per-seat price
    stripe_price_id_meter JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {ai_tokens: price_id, ...}
    seat_included        INT NOT NULL DEFAULT 1,
    quotas               JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {monthly_credits, max_competitors, max_brands, max_scrapes_per_day}
    features             JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ['sso', 'audit_log', 'priority_queue']
    is_visible           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id       TEXT NOT NULL,
    stripe_subscription_id   TEXT NOT NULL UNIQUE,
    plan_id                  VARCHAR(40) NOT NULL REFERENCES plans(id),
    status                   VARCHAR(40) NOT NULL,        -- trialing|active|past_due|canceled|paused
    current_period_start     TIMESTAMPTZ NOT NULL,
    current_period_end       TIMESTAMPTZ NOT NULL,
    cancel_at                TIMESTAMPTZ,
    canceled_at              TIMESTAMPTZ,
    seat_count               INT NOT NULL DEFAULT 1,
    metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_workspace ON subscriptions FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Usage events (the metering ledger)

```sql
-- 0007_usage.sql
-- Append-only ledger. Every metered action writes ONE row.
-- Lago ingests via batch every 60s for billing aggregation.
CREATE TABLE usage_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    user_id         UUID REFERENCES users(id),       -- nullable: scheduled jobs have no user
    event_type      VARCHAR(80) NOT NULL,            -- 'ai_generation' | 'competitor_scan' | 'export_pdf' | ...
    resource_id     TEXT,                            -- e.g. brand_id, run_id
    quantity        INT NOT NULL DEFAULT 1,
    cost_credits    INT NOT NULL,                    -- materialized from rate card at write time
    cost_usd_micros BIGINT,                          -- our cost (LLM tokens, scrape, etc.); for margin tracking
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT UNIQUE,                     -- supplied by emitter to dedupe
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions, auto-created by pg_partman
CREATE INDEX ix_usage_ws_time ON usage_events(workspace_id, created_at DESC);
CREATE INDEX ix_usage_type    ON usage_events(workspace_id, event_type, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_workspace ON usage_events FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
-- INSERT happens from server-side service-role connection (RLS bypassed via SECURITY DEFINER fn)
```

#### Quota / credit ledger (denormalized rollup for fast quota checks)

```sql
-- 0008_quota_ledger.sql
CREATE TABLE workspace_quotas (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    credits_granted     INT NOT NULL,                  -- from plan + topups
    credits_consumed    INT NOT NULL DEFAULT 0,        -- updated by aggregator job
    soft_limit_reached  BOOLEAN NOT NULL DEFAULT FALSE,
    hard_limit_reached  BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workspace_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotas_workspace ON workspace_quotas FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Audit log (compliance-grade)

```sql
-- 0009_audit.sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL,
    actor_user_id   UUID,            -- nullable for system actions
    actor_kind      VARCHAR(20) NOT NULL,   -- 'user' | 'system' | 'api_key' | 'admin_impersonation'
    action          VARCHAR(80) NOT NULL,   -- 'workspace.created', 'member.role_changed', ...
    resource_type   VARCHAR(40),
    resource_id     TEXT,
    before          JSONB,
    after           JSONB,
    ip              INET,
    user_agent      TEXT,
    request_id      TEXT,            -- traceable to OTel span
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_audit_ws_time ON audit_log(workspace_id, created_at DESC);
CREATE INDEX ix_audit_actor   ON audit_log(actor_user_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_workspace ON audit_log FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
-- Admin impersonation actions visible to admins only (filter in app layer)
```

#### Notifications

```sql
-- 0010_notifications.sql
CREATE TABLE notification_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel             VARCHAR(20) NOT NULL,   -- 'email' | 'in_app' | 'webhook' | 'slack'
    event_type          VARCHAR(80) NOT NULL,
    config              JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (workspace_id, user_id, channel, event_type)
);
CREATE TABLE notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL,
    user_id         UUID,
    event_type      VARCHAR(80) NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL,   -- 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
    payload         JSONB NOT NULL,
    delivery_meta   JSONB,
    error           TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries    ENABLE ROW LEVEL SECURITY;
-- policies analogous to other tables
```

#### Public API keys (customer-issued, distinct from Aquila API keys)

```sql
-- 0011_public_api_keys.sql
CREATE TABLE public_api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL UNIQUE,
    key_prefix      VARCHAR(16) NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_pk_workspace ON public_api_keys(workspace_id) WHERE revoked_at IS NULL;
ALTER TABLE public_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY pk_workspace ON public_api_keys FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Webhook subscriptions (customer-defined webhooks Synterra delivers)

```sql
-- 0012_webhooks.sql
CREATE TABLE webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    secret          TEXT NOT NULL,    -- HMAC signing secret (encrypted at rest)
    event_types     TEXT[] NOT NULL,  -- ['research.complete', 'change.detected', ...]
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count   INT NOT NULL DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL,
    event_type      VARCHAR(80) NOT NULL,
    payload         JSONB NOT NULL,
    response_code   INT,
    response_body   TEXT,
    attempt         INT NOT NULL DEFAULT 1,
    succeeded_at    TIMESTAMPTZ,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### B.3 RLS enforcement convention

Every Drizzle query lives behind a `withWorkspaceContext()` helper:

```typescript
// packages/db/src/context.ts
export async function withWorkspaceContext<T>(
  workspaceId: string,
  userId: string,
  fn: (db: DrizzleClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('synterra.workspace_id', ${workspaceId}, true)`);
    await tx.execute(sql`SELECT set_config('synterra.user_id',      ${userId},      true)`);
    return fn(tx);
  });
}
```

**Rule:** No service-layer code accesses Drizzle directly. All access goes through `withWorkspaceContext` — enforced by ESLint rule + a CI grep gate.

**Service-role escape hatch** (limited, audited): a `serviceRoleQuery()` helper using a separate Postgres role that bypasses RLS, used _only_ by:

- BullMQ workers writing `usage_events` (no workspace context)
- Stripe webhook handler creating subscriptions
- Admin impersonation paths (logged to `audit_log` with `actor_kind='admin_impersonation'`)

---

## Section C — Identity, AuthN, AuthZ

### C.1 Decision: better-auth + WorkOS proxy for enterprise

**Primary auth provider:** **[better-auth](https://better-auth.com)** (TypeScript-native, self-hostable, zero vendor lock-in, multi-org built-in, passkeys supported, Drizzle adapter).

**Why not Clerk:** opaque user IDs, multi-org costs extra, hard to leave (vendor lock).
**Why not Supabase Auth standalone:** Synterra Postgres is its own DB; running Supabase stack (PostgREST + GoTrue + Studio) just for auth is overkill.
**Why not Keycloak/Ory:** ops-heavy, identity-focused UI, not SaaS-product-shaped.

**Enterprise SSO (SAML/OIDC) and SCIM:** **WorkOS** (cloud, but acts as a proxy — Synterra issues its own JWTs; WorkOS only handles the SAML negotiation). Switched on per-workspace at the **Scale** plan level. SCIM provisioning via WorkOS Directory Sync auto-creates `users` rows + `workspace_members`.

### C.2 AuthN flows

**Sign-up methods (all enabled day 1):**

1. **Email + magic link** (default — passwordless, no password reset hell)
2. **Email + passkey** (WebAuthn, primary path going forward)
3. **Google OAuth** (one-click for the marketers we target)
4. **GitHub OAuth** (for technical buyers)
5. **SAML/OIDC** (WorkOS, gated to Scale plan)
6. **Email + password** (kept as fallback; not promoted in UI)

**Session model:**

- HTTP-only secure cookie (`synterra_session`), 30-day rolling refresh, 24h JWT lifetime.
- Session record in Postgres (`auth_sessions`, managed by better-auth) with `device_label`, `last_seen_ip`, `revoked_at`.
- Settings → Security shows all active sessions; one-click revoke.

**Multi-workspace JWT issuance:**

- After login, Synterra issues a session cookie scoped to _user identity only_ (no workspace claim).
- When user selects/switches workspace via the switcher, Synterra issues a **scoped JWT** stored in a second cookie `synterra_workspace_jwt` (15-minute TTL, refreshed on activity), claims: `{sub, email, role, workspace_id, aquila_org_slug, plan_id, exp}`.
- Synterra Server Components/Actions read both cookies; RLS context comes from the workspace JWT.
- All Aquila API calls use a **further-scoped JWT** (60-second TTL) minted just before the call, so a stolen browser cookie cannot directly hit Aquila.

### C.3 AuthZ: three layers

**Layer 1 — Workspace membership (binary):** is the user a member of this workspace? Enforced by RLS + middleware.

**Layer 2 — RBAC (six roles, hierarchical):**

| Role      | Read   | Comment | Edit content | Manage members | Manage billing | Delete workspace |
| --------- | ------ | ------- | ------------ | -------------- | -------------- | ---------------- |
| `owner`   | ✓      | ✓       | ✓            | ✓              | ✓              | ✓                |
| `admin`   | ✓      | ✓       | ✓            | ✓              | ✓              | ✗                |
| `manager` | ✓      | ✓       | ✓            | invite only    | ✗              | ✗                |
| `editor`  | ✓      | ✓       | ✓            | ✗              | ✗              | ✗                |
| `viewer`  | ✓      | ✓       | ✗            | ✗              | ✗              | ✗                |
| `guest`   | scoped | scoped  | scoped       | ✗              | ✗              | ✗                |

`guest` is for external collaborators (agencies sharing one client artifact). Permissions defined per-resource via a `resource_acls` table (added in v1.5 when external sharing ships — see workstream W12).

**Layer 3 — Plan/feature gates:** plan-defined `features` array (e.g., `['sso', 'audit_log', 'public_api', 'priority_queue']`) checked by `requireFeature(workspace, 'sso')` middleware. Returns clean upgrade-CTA error.

**Layer 4 (defense in depth) — Quota checks:** `requireCredits(workspace, cost)` middleware checks `workspace_quotas` _before_ enqueuing any cost-incurring action. Soft limit shows warning UI; hard limit blocks + offers add-on credits purchase.

### C.4 Audit + compliance trail

- Every `workspace_members` change → `audit_log` row.
- Every `subscriptions` change → `audit_log` row.
- Every admin impersonation session → opens an `audit_log` row at start + close, all actions during session tagged with `actor_kind='admin_impersonation'`.
- Audit log retention: 7 years for billing-affecting actions, 2 years for member changes, 1 year for content edits. Configurable per workspace at Enterprise plan.

---

## Section D — Workspace Lifecycle & Onboarding

### D.1 Self-serve signup → first wow in ≤ 90 seconds

```
T=0s     User lands on synterra.app/start
         ┌─────────────────────────────────────────────────────┐
         │  "What's your company website?"                    │
         │   [https://acme.com                            ]   │
         │   [   Start Now →   ]                              │
         └─────────────────────────────────────────────────────┘

T=2s     URL submitted (anonymous): Synterra issues an `inflight_bootstrap` row
         keyed by sessionId. Calls Aquila /research with depth=light, anon org
         (`synterra_anon`), gets `run_id`. Returns user to:
         ┌─────────────────────────────────────────────────────┐
         │  We're analyzing acme.com…                          │
         │  ▓▓▓▓▓▓░░░░  fetching homepage                      │
         │  Tell us about you while we work:                   │
         │   Email: [_________________________]                │
         │   Name:  [_________________________]                │
         │   [ Send magic link → ]                             │
         └─────────────────────────────────────────────────────┘

T=15s    Aquila pipeline (light depth) returns: brand DNA, top 3 competitors,
         brand voice draft. Synterra writes preview to `inflight_bootstrap.result`.

T=30s    User clicks magic link in email → lands authenticated on:
         ┌─────────────────────────────────────────────────────┐
         │  Welcome to Acme's workspace                        │
         │  We've already learned this:                        │
         │                                                     │
         │  Industry: DTC men's grooming                       │
         │  Tone: confident, ironic, premium                   │
         │  Top competitors: Harry's, Bevel, Manscaped         │
         │  12 changes detected on competitor sites in last    │
         │      30 days                                        │
         │                                                     │
         │  [ Invite your team → ]   [ Start exploring → ]     │
         └─────────────────────────────────────────────────────┘

T=60s+   User invites team or jumps straight into Battlecards / Brand Voice tools.
         Trial = 14 days, 500 credits, no credit card required.
```

**Why this matters:** Jasper's onboarding takes 4-6 minutes and shows nothing personalized. Notion shows an empty canvas. **The first thing the user sees in Synterra is _correct intelligence about their own brand_** — generated by the Aquila engine they're paying for.

**Engineering details for the bootstrap path:**

- The anonymous URL submission happens against a special `synterra_anon` Aquila org with strict per-IP rate limit (5 light scrapes per IP per hour; Cloudflare WAF rule + Synterra middleware double-check).
- The `inflight_bootstrap` row is GC'd after 24h if not claimed by signup completion.
- On signup completion, Synterra:
  1. Creates `users` row.
  2. Creates `workspaces` row with `bootstrap_state='running'`.
  3. Calls Aquila `POST /orgs` with `{slug, name, plan: 'trial'}` (admin token, S2S only).
  4. Calls Aquila `POST /orgs/{slug}/api-keys` to mint workspace's Aquila key.
  5. Encrypts and stores in `aquila_credentials`.
  6. Re-runs the brand intelligence pipeline against the user's _real_ workspace org (deeper depth this time).
  7. Streams progress to user via Supabase Realtime.
  8. Marks `bootstrap_state='ready'` when done; flips `trial_ends_at` to NOW + 14 days.

**Why not deep depth on first run:** light depth = ~15 seconds (fits the 90-second TTW); deep depth = ~3-5 minutes. Light gives us "yes, we get your brand"; deep gives us "and here are 47 actionable insights" 5 minutes later — _while the user is already invested._

### D.2 Workspace lifecycle states

```
   ┌────────────┐
   │  pending   │  signup started, magic link not clicked
   └──────┬─────┘
          ↓
   ┌────────────┐
   │ provisioning ─→ failed → deleted_at after 24h
   └──────┬─────┘
          ↓ (Aquila org + API key created, bootstrap launched)
   ┌────────────┐
   │ trialing   │  14-day trial; full feature access; usage capped at trial quota
   └──────┬─────┘
          ↓ trial converts (CC added) | trial expires (no CC)
   ┌──────────┐  ┌──────────┐
   │  active  │  │  expired │ → grace 7 days → suspended
   └────┬─────┘  └──────────┘
        ↓ payment fails 3x | cancel requested
   ┌──────────┐
   │ past_due │ → 14 days → suspended
   └────┬─────┘
        ↓
   ┌──────────┐
   │suspended │  read-only, no new actions, banner everywhere
   └────┬─────┘
        ↓ owner reactivates (pays) | 60 days
   ┌──────────┐
   │ deleted  │  soft-delete; data retained 30 days for recovery
   └────┬─────┘
        ↓ 30 days
   ┌──────────┐
   │  purged  │  hard delete from Synterra + Aquila org disabled
   └──────────┘
```

The `workspace-provisioner` BullMQ worker drives all transitions. State changes write to `audit_log`.

### D.3 Workspace switcher UX (Slack/Linear-class)

- Top-left button: workspace logo + name + chevron.
- Click → command-palette-style overlay (kbd `Ctrl+K, W` for power users):
  - Recent workspaces (3 most recently active)
  - All workspaces (paginated, fuzzy-searchable for agencies with 50+)
  - "Create new workspace" CTA (gated by plan: Starter = 1 workspace, Growth = 3, Scale = unlimited)
  - "Join workspace by invite" (paste invite link)
- On switch: Synterra reissues `synterra_workspace_jwt`, re-routes to current workspace's last-visited page (persisted in `users.preferences`).

### D.4 Multi-workspace data model (the agency case)

A Synterra `users` row can be a member of N workspaces. An agency user `gonzalo@nova.com` might be:

- `owner` of "Nova Agency HQ" (their internal workspace)
- `admin` of "Acme Inc" (a client they manage)
- `editor` of "Beta Corp" (another client)
- `viewer` of "Gamma LLC" (a prospective client they're pitching)

Each workspace has its own Aquila org → independent brand intelligence, independent billing, independent quotas. Switcher shows all four; cmd+K can fuzzy-search across them; a single Notification Inbox aggregates events across all four (filterable per workspace).

---

## Section E — Aquila Integration Contract

### E.1 The contract (never hand-wavy)

Synterra communicates with Aquila over HTTPS only, using these endpoints (all already exist or are explicit Aquila-change items):

| Synterra need                        | Aquila endpoint                              | Auth                                           | Status            |
| ------------------------------------ | -------------------------------------------- | ---------------------------------------------- | ----------------- |
| Create workspace's Aquila org        | `POST /orgs`                                 | Admin JWT (Synterra service account on Aquila) | exists            |
| Issue Aquila API key for workspace   | `POST /orgs/{slug}/api-keys`                 | Admin JWT                                      | exists            |
| Rotate workspace API key             | `DELETE /orgs/{slug}/api-keys/{id}` + `POST` | Admin JWT                                      | exists            |
| Trigger research run                 | `POST /research`                             | Workspace JWT                                  | exists            |
| Poll research status                 | `GET /research/{run_id}`                     | Workspace JWT                                  | exists            |
| Stream research events               | (new) `GET /research/{run_id}/stream` (SSE)  | Workspace JWT                                  | **AQUILA CHANGE** |
| Get brand snapshot                   | `GET /brands/{brand_id}`                     | Workspace JWT                                  | exists            |
| List competitors                     | `GET /brands/{brand_id}/competitors`         | Workspace JWT                                  | exists            |
| Subscribe to change events           | `PUT /orgs/{slug}/webhooks/change_events`    | Admin JWT                                      | exists            |
| Get usage report (cost attribution)  | (new) `GET /orgs/{slug}/usage?since=...`     | Admin JWT                                      | **AQUILA CHANGE** |
| Exchange API key for short-lived JWT | (new) `POST /auth/issue-service-token`       | API key                                        | **AQUILA CHANGE** |

### E.2 Aquila changes required (open `Aquila/tasks/todo.md` items, not Synterra's repo)

These three items must land in Aquila _before_ Synterra integration is complete. They are tracked as Aquila tasks. Synterra's plan calls them out so the orchestrator can schedule them.

**AQ-1: `POST /auth/issue-service-token` endpoint**

- Accept: `Authorization: Bearer <api_key_plaintext>`
- Validate: hash + lookup in `org_api_keys`, check `is_active`, check `expires_at`
- Issue: short-lived (60s) JWT with `{sub: api_key_id, org_id, scopes, exp}`
- Update: `org_api_keys.last_used_at`
- Rationale: today Synterra would need to re-implement Aquila JWT signing; this endpoint puts issuance inside Aquila where the secret lives.

**AQ-2: `GET /research/{run_id}/stream` (Server-Sent Events)**

- Stream events: `{type: 'progress', step: 'scraping', percent: 35}` and on completion `{type: 'complete', result_url: '/research/{run_id}'}`
- Backed by Redis pub/sub channel `aquila:run:{run_id}:events` (workers publish to this on each step transition).
- Synterra Web subscribes via Supabase Realtime _or_ native SSE — either works; SSE is simpler.

**AQ-3: `GET /orgs/{slug}/usage?since=...&until=...&granularity=hour`**

- Returns aggregated counts of metered events: `{ai_tokens: int, scrapes: int, llm_cost_usd_micros: int, ...}`
- Aquila already has metric primitives (per-worker logs, Prometheus); this endpoint surfaces them as JSON for Synterra's metering pipeline.
- Backed by Aquila's existing OTel/Prometheus metric stream + a small aggregation cache.

These are filed in `Aquila/tasks/todo.md` as a new section "Aquila changes for Synterra integration" with the same `[x]/[ ]` convention.

### E.3 Synterra-side: typed Aquila client

`packages/aquila-client/` is a typed TypeScript wrapper:

```typescript
// packages/aquila-client/src/index.ts
export class AquilaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenProvider: () => Promise<string>,
  ) {}

  async submitResearch(input: ResearchRequest): Promise<{ run_id: string }> {
    /* ... */
  }
  async getResearch(run_id: string): Promise<ResearchResult> {
    /* ... */
  }
  streamResearch(run_id: string): ReadableStream<ResearchEvent> {
    /* ... */
  }
  async getBrand(brand_id: string): Promise<BrandSnapshot> {
    /* ... */
  }
  async listCompetitors(brand_id: string): Promise<Competitor[]> {
    /* ... */
  }
  async getUsage(since: Date, until: Date): Promise<UsageReport> {
    /* ... */
  }
}

// Per-request factory: tokenProvider() mints a fresh 60s JWT via AQ-1.
export async function aquilaForWorkspace(workspaceId: string): Promise<AquilaClient> {
  const creds = await loadAquilaCredentials(workspaceId); // reads aquila_credentials, decrypts secret
  return new AquilaClient(
    env.AQUILA_BASE_URL,
    async () => exchangeApiKeyForJwt(creds.api_key_secret), // calls AQ-1
  );
}
```

**Resilience:** circuit breaker (3 consecutive failures → open for 60s), retries with exponential backoff for idempotent reads (max 3), no retries for non-idempotent writes (relies on `Idempotency-Key` header).

**Observability:** every Aquila call is wrapped in an OTel span with attributes `synterra.workspace_id`, `aquila.org_slug`, `aquila.endpoint`, `aquila.run_id` — propagated to Aquila via `traceparent` header so traces span both services.

### E.4 Per-tenant Aquila knowledge surface

Each workspace's data already lives in Aquila:

- **Postgres** `brand_intelligence` filtered by `org_id = workspace.aquila_org_slug`
- **Neo4j** nodes/relationships keyed `(org_id, ...)`
- **Qdrant** `kb_verified` / `kb_exploratory` filtered by `org_id` payload
- **Per-org webhooks** subscribing to change events

Synterra never queries Aquila's databases directly. It always goes through Aquila API. (Design rule: if a query would be expensive across HTTP, the right answer is to add an Aquila endpoint that returns the rolled-up shape, not to give Synterra direct DB access.)

---

## Section F — Billing & Metering

### F.1 Plan structure

| Plan           | Price (USD/mo)       | Seats     | Workspaces | Credits/mo | Key features                                                            |
| -------------- | -------------------- | --------- | ---------- | ---------- | ----------------------------------------------------------------------- |
| **Trial**      | free, 14 days        | 3         | 1          | 500        | full Growth feature set                                                 |
| **Starter**    | $49/mo or $490/yr    | 3         | 1          | 1,000      | core tools, weekly digest, in-app notifications                         |
| **Growth**     | $199/mo or $1,990/yr | 10        | 3          | 8,000      | + competitor monitoring, public API, webhooks, Slack integration        |
| **Scale**      | $499/mo or $4,990/yr | 25        | unlimited  | 30,000     | + SSO/SAML, SCIM, audit log export, priority queue, white-label exports |
| **Enterprise** | custom               | unlimited | unlimited  | custom     | + dedicated tenancy, custom SLA, dedicated CSM, custom retention        |

**Add-ons (à la carte):**

- Extra seat: $15/seat/mo
- Credit pack: $50 / 5,000 credits (top-up, never expires until plan downgrade)
- Dedicated DB tenancy: +$500/mo
- Custom subdomain (`acme.synterra.app`): included Growth+
- Custom domain CNAME (`brand-intel.acme.com`): included Scale+

**Why credits, not raw API calls:** simpler UX, predictable spend, lets us re-weight cost as our backend costs change. Internally, 1 credit ≈ $0.005 of our actual cost (LLM tokens, scrape, storage).

### F.2 Metering architecture

```
Aquila workers emit metric per action  ─┐
                                         ▼
                              ┌──────────────────┐
                              │  Aquila exposes  │
                              │  GET /orgs/{}/   │
                              │  usage           │  (AQ-3)
                              └────────┬─────────┘
                                       │
              every 60s, BullMQ        │
              "usage-aggregator"  ─────┘
              job pulls per-workspace
                                       │
                                       ▼
                       ┌──────────────────────────┐
                       │  Synterra DB:            │
                       │  - INSERT into           │
                       │    usage_events          │
                       │  - UPDATE                │
                       │    workspace_quotas      │
                       └──────────┬───────────────┘
                                  │
                                  ▼
                       ┌──────────────────────────┐
                       │  Lago (self-hosted):     │
                       │  POST /events            │
                       │  with idempotency_key    │
                       └──────────┬───────────────┘
                                  │
                                  ▼
                       Stripe (via Lago):
                       monthly invoice draft
                       finalized day 1 each month
```

**Idempotency:** `usage_events.idempotency_key = '{workspace_id}:{aquila_event_id}'` — repeated aggregations produce zero duplicates.

**Quota enforcement (hard real-time):**

1. Synterra Server Action receives "Generate brand voice" request.
2. Check `workspace_quotas.credits_consumed >= credits_granted - cost`?
   - **Soft (90%)**: dispatch action + show inline warning UI.
   - **Hard (100%)**: block, return JSON `{error: 'quota_exceeded', upgrade_url, topup_url}`, render upgrade modal.
3. Optimistically debit `workspace_quotas.credits_consumed += cost` _before_ enqueuing Aquila call (with compensating decrement on Aquila failure).
4. Real consumption reconciled by aggregator job within 60s.

**Why double-bookkeep (Synterra `usage_events` AND Lago):** Synterra `usage_events` is for fast in-app analytics (what did I spend on this week?). Lago is the source of truth for invoicing. Periodic reconciliation alerts if drift > 0.5%.

### F.3 Stripe wiring

- Stripe Customer per workspace (1:1).
- Stripe Subscription per workspace.
- Webhooks endpoint: `POST /api/webhooks/stripe` → BullMQ `stripe-events` queue → idempotent processor.
- Customer portal: Stripe-hosted for v1 (handles updates, invoices, dunning); custom-built billing UI inside app for in-context upgrades.
- Tax: Stripe Tax enabled (3% fee, worth it vs. tax compliance time).
- Dunning: Stripe Smart Retries + custom in-app banner when subscription is `past_due`.

### F.4 Lago self-hosted deployment

- Runs in same LXC as Synterra (or sibling LXC if isolation needed).
- Postgres for Lago is a _separate database_ in the same Postgres instance.
- Lago dashboard accessible only to Synterra admins via VPN/Tailscale (not public).
- Replication concern: Lago is the source of truth for invoicing — nightly backup to S3 + offsite.

---
