-- W3-3: Backfill workspace_quotas for all active subscriptions.
-- Subsequent upserts happen via the Stripe webhook worker (seedWorkspaceQuota).
INSERT INTO workspace_quotas (
  workspace_id,
  period_start,
  period_end,
  credits_granted,
  credits_consumed
)
SELECT
  s.workspace_id,
  s.current_period_start,
  s.current_period_end,
  COALESCE((p.quotas->>'monthly_credits')::int, 500),
  0
FROM subscriptions s
JOIN plans p ON p.id = s.plan_id
WHERE s.status <> 'canceled'
ON CONFLICT (workspace_id) DO NOTHING;
