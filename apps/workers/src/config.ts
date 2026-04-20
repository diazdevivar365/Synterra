/**
 * Synterra Workers — environment configuration.
 *
 * Parsed eagerly on import. Failures abort boot with a readable summary of
 * the offending keys. The exported `env` object is consumed by the logger,
 * redis connection factory, BullMQ worker, and health sidecar.
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  HEALTH_PORT: z.coerce.number().int().positive().default(3002),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(15_000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  // Database — provisioner writes aquila_credentials
  DATABASE_URL: z.string().url(),
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  // Aquila provisioner
  AQUILA_BASE_URL: z.string().url(),
  AQUILA_PROVISIONER_SECRET: z.string().min(16),
  // 64 hex chars = 32 bytes = AES-256 key for envelope-encrypting API key secrets
  AQUILA_ENCRYPT_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex chars (32-byte AES-256 key)'),
  // Lago — metering (self-hosted at metering.lan)
  LAGO_API_URL: z.string().url().default('http://metering.lan:3000'),
  LAGO_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `[Synterra Workers] Invalid environment configuration:\n${issues}\n` +
      `Set the variables above (see docs) before starting the service.`,
  );
}

export const env: Env = parsed.data;
