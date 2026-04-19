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

export {
  createWorkOSClient,
  createWorkOSOrganization,
  getSsoAuthorizationUrl,
  exchangeSsoCode,
  getAdminPortalLink,
  constructScimEvent,
  type WorkOSProfile,
  type ScimUser,
  type ScimEvent,
  type ScimEventType,
} from './workos.js';
