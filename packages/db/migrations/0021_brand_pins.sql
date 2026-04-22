CREATE TABLE IF NOT EXISTS brand_pins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  brand_id     TEXT NOT NULL,
  pinned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_brand_pins UNIQUE (workspace_id, user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS ix_brand_pins_ws_user ON brand_pins (workspace_id, user_id);
