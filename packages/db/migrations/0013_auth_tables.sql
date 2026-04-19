-- W1-1: Align users.email_verified to BOOLEAN (was TIMESTAMPTZ);
--       add better-auth session/account/verification tables (ba_ prefix).

-- 1. Fix email_verified type (no prod data — safe drop/add)
ALTER TABLE users DROP COLUMN email_verified;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. ba_session — better-auth session store
CREATE TABLE ba_session (
  id           TEXT PRIMARY KEY,
  expires_at   TIMESTAMPTZ NOT NULL,
  token        TEXT NOT NULL UNIQUE,
  ip_address   TEXT,
  user_agent   TEXT,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ba_session_user  ON ba_session(user_id);

-- 3. ba_account — OAuth / magic-link account links
CREATE TABLE ba_account (
  id                        TEXT PRIMARY KEY,
  account_id                TEXT NOT NULL,
  provider_id               TEXT NOT NULL,
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token              TEXT,
  refresh_token             TEXT,
  id_token                  TEXT,
  access_token_expires_at   TIMESTAMPTZ,
  refresh_token_expires_at  TIMESTAMPTZ,
  scope                     TEXT,
  password                  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ba_account_provider UNIQUE (provider_id, account_id)
);
CREATE INDEX ix_ba_account_user ON ba_account(user_id);

-- 4. ba_verification — magic link / OTP tokens
CREATE TABLE ba_verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_ba_verification_identifier ON ba_verification(identifier);
