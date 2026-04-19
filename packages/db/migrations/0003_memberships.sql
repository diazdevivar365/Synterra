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

CREATE INDEX ix_members_user ON workspace_members(user_id)       WHERE NOT is_disabled;
CREATE INDEX ix_members_ws   ON workspace_members(workspace_id)  WHERE NOT is_disabled;

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_self_view ON workspace_members FOR SELECT
  USING (
    user_id = current_setting('synterra.user_id', true)::UUID
    OR workspace_id = current_setting('synterra.workspace_id', true)::UUID
  );

CREATE POLICY members_admin_write ON workspace_members FOR ALL
  USING (
    workspace_id = current_setting('synterra.workspace_id', true)::UUID
    AND EXISTS (
      SELECT 1 FROM workspace_members m
       WHERE m.workspace_id = workspace_members.workspace_id
         AND m.user_id = current_setting('synterra.user_id', true)::UUID
         AND m.role IN ('owner', 'admin')
    )
  );
