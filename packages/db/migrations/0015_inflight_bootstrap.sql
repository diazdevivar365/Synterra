-- inflight_bootstrap: tracks anonymous onboarding sessions (W2-3)
-- GC'd after 24h if not claimed.

CREATE TABLE inflight_bootstrap (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text        NOT NULL UNIQUE,
  url           text        NOT NULL,
  ip            text,
  email         text,
  user_id       uuid        REFERENCES users(id) ON DELETE SET NULL,
  workspace_id  uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  aquila_run_id text,
  result        jsonb,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','running','ready','claimed','expired')),
  expires_at    timestamptz NOT NULL DEFAULT now() + INTERVAL '24 hours',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inflight_bootstrap_session_idx ON inflight_bootstrap(session_id);
CREATE INDEX inflight_bootstrap_expires_idx ON inflight_bootstrap(expires_at);
