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
