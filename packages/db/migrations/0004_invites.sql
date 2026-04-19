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
