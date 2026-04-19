import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';

// ReturnType annotation prevents TS2742 (non-portable inferred type leaking
// an internal zod path from better-auth's generated types).
type AuthClient = ReturnType<typeof createAuthClient>;

export const authClient: AuthClient = createAuthClient({
  baseURL: process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
