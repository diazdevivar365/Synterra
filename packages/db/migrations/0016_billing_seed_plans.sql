-- Idempotent seed: upsert all 5 billing plans.
-- stripe_product_id values are placeholders; real IDs are set in Infisical
-- and applied via the Stripe sync script — never hardcoded here.
INSERT INTO plans (id, name, stripe_product_id, seat_included, quotas, features, is_visible)
VALUES
  ('trial',      'Trial',      'prod_placeholder_trial',      3,    '{"monthly_credits":500,"seats":3,"workspaces":1,"trial_days":14}',  '[]', false),
  ('starter',    'Starter',    'prod_placeholder_starter',    3,    '{"monthly_credits":1000,"seats":3,"workspaces":1}',                 '[]', true),
  ('growth',     'Growth',     'prod_placeholder_growth',     10,   '{"monthly_credits":8000,"seats":10,"workspaces":3}',                '[]', true),
  ('scale',      'Scale',      'prod_placeholder_scale',      25,   '{"monthly_credits":30000,"seats":25,"workspaces":-1}',              '[]', true),
  ('enterprise', 'Enterprise', 'prod_placeholder_enterprise', 9999, '{"monthly_credits":-1,"seats":-1,"workspaces":-1}',                 '[]', false)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  stripe_product_id = EXCLUDED.stripe_product_id,
  seat_included     = EXCLUDED.seat_included,
  quotas            = EXCLUDED.quotas,
  features          = EXCLUDED.features,
  is_visible        = EXCLUDED.is_visible;
