CREATE TABLE webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    secret          TEXT NOT NULL,
    event_types     TEXT[] NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count   INT NOT NULL DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL,
    event_type      TEXT NOT NULL,
    payload         TEXT NOT NULL,
    response_code   INT,
    response_body   TEXT,
    attempt         INT NOT NULL DEFAULT 1,
    succeeded_at    TIMESTAMPTZ,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_endpoints  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY wh_endpoint_workspace ON webhook_endpoints FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);

CREATE POLICY wh_delivery_workspace ON webhook_deliveries FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
