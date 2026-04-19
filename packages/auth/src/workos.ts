import 'server-only';

import { WorkOS } from '@workos-inc/node';

export interface WorkOSProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organizationId: string | null;
  connectionId: string;
}

export interface ScimUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  state: 'active' | 'inactive';
  directoryId: string;
  organizationId: string | null;
}

export type ScimEventType =
  | 'dsync.user.created'
  | 'dsync.user.updated'
  | 'dsync.user.deleted'
  | 'dsync.group.user_added'
  | 'dsync.group.user_removed';

export interface ScimEvent {
  event: ScimEventType;
  data: ScimUser;
}

// SDK enums are not re-exported from the package's main entry.
// These local aliases use string literals that match the enum runtime values,
// cast to the opaque enum type via the established `as unknown as` pattern.
type PortalGenerateLink = (opts: {
  organization: string;
  intent: string;
  returnUrl?: string;
  successUrl?: string;
}) => Promise<{ link: string }>;

type CreateOrgFn = (opts: {
  name: string;
  domainData?: { domain: string; state: string }[];
}) => Promise<{ id: string }>;

export function createWorkOSClient(apiKey: string): WorkOS {
  return new WorkOS(apiKey);
}

export async function createWorkOSOrganization(
  workos: WorkOS,
  name: string,
  domain: string,
): Promise<{ id: string }> {
  return (workos.organizations.createOrganization as unknown as CreateOrgFn)({
    name,
    domainData: [{ domain, state: 'verified' }],
  });
}

export function getSsoAuthorizationUrl(
  workos: WorkOS,
  opts: {
    connectionId: string;
    clientId: string;
    redirectUri: string;
    state: string;
  },
): string {
  return workos.sso.getAuthorizationUrl({
    connection: opts.connectionId,
    clientId: opts.clientId,
    redirectUri: opts.redirectUri,
    state: opts.state,
  });
}

export async function exchangeSsoCode(
  workos: WorkOS,
  code: string,
  clientId: string,
): Promise<WorkOSProfile> {
  const { profile } = await workos.sso.getProfileAndToken({ code, clientId });
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    organizationId: profile.organizationId ?? null,
    connectionId: profile.connectionId,
  };
}

export async function getAdminPortalLink(
  workos: WorkOS,
  organizationId: string,
  intent: 'sso' | 'dsync' = 'sso',
): Promise<string> {
  const { link } = await (workos.portal.generateLink as unknown as PortalGenerateLink)({
    organization: organizationId,
    intent,
  });
  return link;
}

export async function constructScimEvent(
  workos: WorkOS,
  payload: unknown,
  sigHeader: string,
  secret: string,
): Promise<ScimEvent | null> {
  const event = await workos.webhooks.constructEvent({ payload, sigHeader, secret });

  const userEvents = new Set(['dsync.user.created', 'dsync.user.updated', 'dsync.user.deleted']);
  const groupUserEvents = new Set(['dsync.group.user_added', 'dsync.group.user_removed']);

  if (userEvents.has(event.event)) {
    const e = event as unknown as { event: ScimEventType; data: ScimUser };
    return { event: e.event, data: e.data };
  }

  if (groupUserEvents.has(event.event)) {
    const e = event as unknown as { event: ScimEventType; data: { user: ScimUser } };
    return { event: e.event, data: e.data.user };
  }

  return null;
}
