// Vitest setup — runs before each test file's module graph is evaluated.
// Provides the env vars that config.ts validates at import time so tests
// that transitively import logger → config don't throw.
// Tests that need different values should vi.mock('./config.js') directly.
process.env['DATABASE_URL'] ??= 'postgres://localhost:5432/test';
process.env['AQUILA_BASE_URL'] ??= 'https://aquila.test.invalid';
process.env['AQUILA_PROVISIONER_SECRET'] ??= 'test-provisioner-secret-1234';
process.env['AQUILA_ENCRYPT_KEY'] ??= 'a'.repeat(64);
process.env['STRIPE_SECRET_KEY'] ??= 'sk_test_placeholder_for_tests';
