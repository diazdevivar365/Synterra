-- W5-4: Slack integration — per-workspace bot token storage

CREATE TABLE IF NOT EXISTS slack_connections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id              VARCHAR(20)  NOT NULL,
  team_name            VARCHAR(100) NOT NULL,
  encrypted_bot_token  TEXT         NOT NULL,
  default_channel_id   VARCHAR(20)  NOT NULL,
  default_channel_name VARCHAR(100) NOT NULL,
  is_enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_slack_connections_workspace ON slack_connections (workspace_id);
