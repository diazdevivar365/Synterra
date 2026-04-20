CREATE TABLE IF NOT EXISTS inflight_bootstrap (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url_input     text        NOT NULL,
  email         text,
  aquila_run_id text,
  workspace_id  uuid        REFERENCES workspaces(id),
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
