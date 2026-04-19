import 'server-only';

import { betterAuth, type Auth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';

import { baAccounts, baSessions, baVerifications, users, type Database } from '@synterra/db';

import type { AuthEnv } from './env.js';

export interface BetterAuthConfig {
  db: Database;
  env: AuthEnv;
}

export function createBetterAuth({ db, env }: BetterAuthConfig): Auth {
  const isProd = env.BETTER_AUTH_URL.startsWith('https://') && !!env.RESEND_API_KEY;

  // Cast required: betterAuth<Options> returns Auth<Options> which is not
  // assignable to Auth<BetterAuthOptions> due to the contravariant Options
  // generic on DBAdapter. The runtime value is correct; this cast only widens
  // the type for consumers that need a stable, portable Auth reference.
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: users,
        session: baSessions,
        account: baAccounts,
        verification: baVerifications,
      },
    }),

    user: {
      fields: {
        image: 'avatarUrl',
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if (!isProd) {
            console.info(`[magic-link] to=${email} url=${url}`);
            return;
          }
          const { Resend } = await import('resend');
          const resend = new Resend(env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Forgentic <no-reply@forgentic.io>',
            to: email,
            subject: 'Your Forgentic sign-in link',
            html: `<p>Sign in to Forgentic:</p><p><a href="${url}">${url}</a></p><p>Expires in 10 minutes.</p>`,
          });
        },
      }),
    ],

    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },

    trustedOrigins: [env.BETTER_AUTH_URL],
  }) as unknown as Auth;
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
