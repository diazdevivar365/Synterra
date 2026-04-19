-- Required Postgres extensions for the Synterra control-plane DB.
-- Must run before any table migration.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";    -- case-insensitive text for emails
