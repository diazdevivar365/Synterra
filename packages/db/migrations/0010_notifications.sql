CREATE TABLE notification_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         VARCHAR(20) NOT NULL,
    event_type      VARCHAR(80) NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (workspace_id, user_id, channel, event_type)
);

CREATE TABLE notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL,
    user_id         UUID,
    event_type      VARCHAR(80) NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    payload         JSONB NOT NULL,
    delivery_meta   JSONB,
    error           TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries    ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_sub_workspace ON notification_subscriptions FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);

CREATE POLICY notif_del_workspace ON notification_deliveries FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
