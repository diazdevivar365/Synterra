export { createBetterAuth } from './server.js';
export type { BetterAuthConfig, BetterAuthInstance } from './server.js';
export { parseAuthEnv } from './env.js';
export type { AuthEnv } from './env.js';

export {
  signWorkspaceJwt,
  verifyWorkspaceJwt,
  type WorkspaceJwtPayload,
  type WorkspaceRole,
} from './workspace-jwt.js';
