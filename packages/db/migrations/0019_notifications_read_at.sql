-- packages/db/migrations/0019_notifications_read_at.sql
ALTER TABLE notification_deliveries ADD COLUMN read_at TIMESTAMPTZ;

-- Index for fast unread-count queries per user/workspace
CREATE INDEX ix_notif_del_unread
  ON notification_deliveries (workspace_id, user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Allow users to mark their own in-app deliveries as read.
-- Requires synterra.workspace_id AND synterra.user_id to be set in session.
CREATE POLICY notif_del_mark_read ON notification_deliveries FOR UPDATE
  USING (
    workspace_id = current_setting('synterra.workspace_id', true)::UUID
    AND user_id   = current_setting('synterra.user_id',      true)::UUID
  )
  WITH CHECK (
    workspace_id = current_setting('synterra.workspace_id', true)::UUID
  );
