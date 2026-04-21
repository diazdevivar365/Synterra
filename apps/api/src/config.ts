/**
 * Synterra API — environment configuration.
 *
 * Parsed eagerly on import. Failures abort boot with a readable summary of
 * the offending keys. The exported `env` object is immutable at the type
 * level and consumed by every other module (logger, server, middleware).
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(10_000),
  DATABASE_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `[Forgentic API] Invalid environment configuration:\n${issues}\n` +
      `Set the variables above (see docs) before starting the service.`,
  );
}

export const env: Env = parsed.data;
