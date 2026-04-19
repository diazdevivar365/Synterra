-- Denormalized rollup for fast quota checks — updated by the aggregator worker.
CREATE TABLE workspace_quotas (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    credits_granted     INT NOT NULL,
    credits_consumed    INT NOT NULL DEFAULT 0,
    soft_limit_reached  BOOLEAN NOT NULL DEFAULT FALSE,
    hard_limit_reached  BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspace_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotas_workspace ON workspace_quotas FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
