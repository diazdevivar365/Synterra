import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'guest';

export interface WorkspaceJwtPayload {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  slug: string;
}

interface WorkspaceJwtClaims extends JWTPayload, WorkspaceJwtPayload {}

const DEFAULT_EXPIRES_IN = '8h';

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signWorkspaceJwt(
  payload: WorkspaceJwtPayload,
  secret: string,
  options?: { expiresIn?: string },
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(options?.expiresIn ?? DEFAULT_EXPIRES_IN)
    .sign(encodeSecret(secret));
}

export async function verifyWorkspaceJwt(
  token: string,
  secret: string,
): Promise<WorkspaceJwtPayload> {
  const { payload } = await jwtVerify<WorkspaceJwtClaims>(token, encodeSecret(secret));
  return {
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    role: payload.role,
    slug: payload.slug,
  };
}
