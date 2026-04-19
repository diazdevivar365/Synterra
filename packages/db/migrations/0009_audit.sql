-- Compliance-grade audit log. Partitioned by month.
CREATE TABLE audit_log (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL,
    actor_user_id   UUID,
    actor_kind      VARCHAR(20) NOT NULL,
    action          VARCHAR(80) NOT NULL,
    resource_type   VARCHAR(40),
    resource_id     TEXT,
    before          JSONB,
    after           JSONB,
    ip              INET,
    user_agent      TEXT,
    request_id      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_default PARTITION OF audit_log DEFAULT;

CREATE INDEX ix_audit_ws_time ON audit_log(workspace_id, created_at DESC);
CREATE INDEX ix_audit_actor   ON audit_log(actor_user_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_workspace ON audit_log FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
