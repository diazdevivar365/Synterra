CREATE TABLE IF NOT EXISTS inflight_bootstrap (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url_input     text        NOT NULL,
  email         text,
  aquila_run_id text,
  workspace_id  uuid        REFERENCES workspaces(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending',
  preview_data  jsonb,
  error         text,
  ip_hash       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  claimed_at    timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_inflight_bootstrap_status  ON inflight_bootstrap(status);
CREATE INDEX IF NOT EXISTS idx_inflight_bootstrap_email   ON inflight_bootstrap(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inflight_bootstrap_expires ON inflight_bootstrap(expires_at);

-- Enable RLS. Pre-claim rows have no workspace_id (anonymous), so we use
-- a service-role bypass for inserts. Claimed rows are scoped by workspace.
ALTER TABLE inflight_bootstrap ENABLE ROW LEVEL SECURITY;

-- Service role can read/write all rows (used by workers and Server Actions)
CREATE POLICY inflight_service_all ON inflight_bootstrap
  TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can only read their own workspace's claimed rows
CREATE POLICY inflight_workspace_select ON inflight_bootstrap
  FOR SELECT
  USING (
    workspace_id IS NULL  -- allow reading anonymous/unclaimed rows by their ID
    OR workspace_id::text = current_setting('synterra.workspace_id', true)
  );
