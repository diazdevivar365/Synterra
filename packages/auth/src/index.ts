export { createBetterAuth } from './server';
export type { BetterAuthConfig, BetterAuthInstance } from './server';
export { parseAuthEnv } from './env';
export type { AuthEnv } from './env';

export {
  signWorkspaceJwt,
  verifyWorkspaceJwt,
  type WorkspaceJwtPayload,
  type WorkspaceRole,
} from './workspace-jwt';

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
} from './workos';
