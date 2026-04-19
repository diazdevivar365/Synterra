CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    email_verified  TIMESTAMPTZ,
    name            TEXT,
    avatar_url      TEXT,
    locale          TEXT DEFAULT 'en',
    last_login_at   TIMESTAMPTZ,
    is_suspended    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users is NOT row-restricted — a user always reads their own record;
-- visibility of other users is gated by workspace_members membership.
