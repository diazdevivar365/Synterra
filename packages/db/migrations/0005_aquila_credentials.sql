-- Per-workspace Aquila credentials. Plaintext API key NEVER stored here —
-- only the prefix and the envelope-encrypted secret.
CREATE TABLE aquila_credentials (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_id          UUID NOT NULL,
    api_key_prefix      VARCHAR(16) NOT NULL,
    api_key_secret_enc  BYTEA NOT NULL,
    scopes              TEXT[] NOT NULL DEFAULT '{*}',
    last_rotated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE aquila_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY aquila_creds_workspace ON aquila_credentials FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
