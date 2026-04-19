CREATE TABLE workspaces (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug               VARCHAR(80) UNIQUE NOT NULL,
    name               TEXT NOT NULL,
    aquila_org_slug    VARCHAR(80) UNIQUE NOT NULL,
    plan_id            VARCHAR(40) NOT NULL DEFAULT 'trial',
    plan_status        VARCHAR(40) NOT NULL DEFAULT 'trialing',
    trial_ends_at      TIMESTAMPTZ,
    db_routing_key     VARCHAR(80) NOT NULL DEFAULT 'shared',
    settings           JSONB NOT NULL DEFAULT '{}'::jsonb,
    branding           JSONB NOT NULL DEFAULT '{}'::jsonb,
    bootstrap_url      TEXT,
    bootstrap_state    VARCHAR(40) NOT NULL DEFAULT 'pending',
    suspended_at       TIMESTAMPTZ,
    suspension_reason  TEXT,
    deleted_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_workspaces_plan   ON workspaces(plan_id)  WHERE deleted_at IS NULL;
CREATE INDEX ix_workspaces_active ON workspaces(id)       WHERE deleted_at IS NULL AND suspended_at IS NULL;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
-- RLS policies referencing workspace_members are added in 0003_memberships.sql
