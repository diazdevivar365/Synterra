import { PostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '@synterra/db';

import { createBetterAuth, type BetterAuthInstance } from './server.js';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
let authInstance: BetterAuthInstance;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  const sql = postgres(url, { max: 1 });

  // Bootstrap schema inline (mirrors 0001_users.sql + 0013_auth_tables.sql)
  await sql.unsafe(`
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      name TEXT, avatar_url TEXT, locale TEXT DEFAULT 'en',
      last_login_at TIMESTAMPTZ, is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE ba_session (
      id TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL UNIQUE, ip_address TEXT, user_agent TEXT,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE ba_account (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT, refresh_token TEXT, id_token TEXT,
      access_token_expires_at TIMESTAMPTZ, refresh_token_expires_at TIMESTAMPTZ,
      scope TEXT, password TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_ba_account_provider UNIQUE (provider_id, account_id)
    );
    CREATE TABLE ba_verification (
      id TEXT PRIMARY KEY, identifier TEXT NOT NULL,
      value TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await sql.end();

  const db = createDb(url);

  authInstance = createBetterAuth({
    db,
    env: {
      BETTER_AUTH_SECRET: 'integration-test-secret-min-32-chars-ok',
      BETTER_AUTH_URL: 'http://localhost:3000',
      DATABASE_URL: url,
    },
  });
}, 60_000);

afterAll(async () => {
  await container.stop();
});

describe('createBetterAuth — magic link flow', () => {
  it('returns an instance with a handler function', () => {
    expect(typeof authInstance.handler).toBe('function');
  });

  it('magic-link sign-in request returns 200 with status:true', async () => {
    // better-auth 1.6.x magic-link endpoint
    const req = new Request('http://localhost:3000/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'integration@forgentic.io',
        callbackURL: '/dashboard',
      }),
    });

    const res = await authInstance.handler(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    // better-auth returns { status: true } or { token: '...' } for magic-link
    expect(body['status'] === true || typeof body['token'] === 'string').toBe(true);
  });
});
