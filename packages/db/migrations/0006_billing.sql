CREATE TABLE plans (
    id                    VARCHAR(40) PRIMARY KEY,
    name                  TEXT NOT NULL,
    description           TEXT,
    stripe_product_id     TEXT NOT NULL,
    stripe_price_id_seat  TEXT,
    stripe_price_id_meter JSONB NOT NULL DEFAULT '{}'::jsonb,
    seat_included         INT NOT NULL DEFAULT 1,
    quotas                JSONB NOT NULL DEFAULT '{}'::jsonb,
    features              JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_visible            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed trial plan so new workspaces can reference it immediately.
INSERT INTO plans (id, name, stripe_product_id, quotas)
VALUES ('trial', 'Trial', 'prod_placeholder_trial', '{"monthly_credits": 1000}');

CREATE TABLE subscriptions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id       TEXT NOT NULL,
    stripe_subscription_id   TEXT NOT NULL UNIQUE,
    plan_id                  VARCHAR(40) NOT NULL REFERENCES plans(id),
    status                   VARCHAR(40) NOT NULL,
    current_period_start     TIMESTAMPTZ NOT NULL,
    current_period_end       TIMESTAMPTZ NOT NULL,
    cancel_at                TIMESTAMPTZ,
    canceled_at              TIMESTAMPTZ,
    seat_count               INT NOT NULL DEFAULT 1,
    metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_workspace ON subscriptions FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
