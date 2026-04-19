// Stub replaced when W1-1 (better-auth) lands.
import { ForbiddenError } from './errors.js';

export interface RequestSession {
  userId: string;
  email: string;
}

export function getSessionOrThrow(): Promise<RequestSession> {
  // TODO(W1-1): replace with real better-auth getSession()
  return Promise.reject(new ForbiddenError('Authentication not yet wired — see W1-1'));
}
