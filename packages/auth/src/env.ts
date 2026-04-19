import { z } from 'zod';

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid postgres URL'),
  RESEND_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_WEBHOOK_SECRET: z.string().optional(),
});

export type AuthEnv = z.infer<typeof schema>;

export function parseAuthEnv(raw: Record<string, string | undefined> = process.env): AuthEnv {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Auth env validation failed:\n${lines.join('\n')}`);
  }
  return result.data;
}
