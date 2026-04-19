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

CREATE POLICY workspaces_member_read ON workspaces FOR SELECT
  USING (
    id = current_setting('synterra.workspace_id', true)::UUID
    OR EXISTS (
      SELECT 1 FROM workspace_members
       WHERE workspace_id = workspaces.id
         AND user_id = current_setting('synterra.user_id', true)::UUID
    )
  );

CREATE POLICY workspaces_owner_write ON workspaces FOR UPDATE
  USING (
    id = current_setting('synterra.workspace_id', true)::UUID
    AND EXISTS (
      SELECT 1 FROM workspace_members
       WHERE workspace_id = workspaces.id
         AND user_id = current_setting('synterra.user_id', true)::UUID
         AND role IN ('owner', 'admin')
    )
  );
