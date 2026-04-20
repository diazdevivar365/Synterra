-- brand_changes: stores inbound change events from Aquila (W4-2)
-- Every row is scoped to a workspace; brand_id matches Aquila's internal brand id.

CREATE TABLE brand_changes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id      text        NOT NULL,
  event_type    text        NOT NULL,
  severity      text        NOT NULL DEFAULT 'info'
                            CHECK (severity IN ('info', 'warning', 'critical')),
  title         text        NOT NULL,
  description   text,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_changes_ws_brand
  ON brand_changes (workspace_id, brand_id, occurred_at DESC);
