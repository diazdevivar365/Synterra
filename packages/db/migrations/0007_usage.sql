-- Append-only metering ledger. Partitioned by month.
-- Monthly partitions are created by application code (or pg_partman when installed).
CREATE TABLE usage_events (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    user_id         UUID REFERENCES users(id),
    event_type      VARCHAR(80) NOT NULL,
    resource_id     TEXT,
    quantity        INT NOT NULL DEFAULT 1,
    cost_credits    INT NOT NULL,
    cost_usd_micros BIGINT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Bootstrap partition covering the current quarter so inserts don't fail
-- before the first automated monthly partition is created.
CREATE TABLE usage_events_default PARTITION OF usage_events DEFAULT;

CREATE INDEX ix_usage_ws_time ON usage_events(workspace_id, created_at DESC);
CREATE INDEX ix_usage_type    ON usage_events(workspace_id, event_type, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- INSERT comes from service-role connection (RLS bypassed via SECURITY DEFINER function).
CREATE POLICY usage_workspace ON usage_events FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
