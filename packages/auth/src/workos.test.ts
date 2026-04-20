import { describe, expect, it, vi } from 'vitest';

import {
  constructScimEvent,
  type createWorkOSClient,
  exchangeSsoCode,
  getAdminPortalLink,
  getSsoAuthorizationUrl,
} from './workos';

vi.mock('server-only', () => ({}));
vi.mock('@workos-inc/node');

const makeWorkos = () =>
  ({
    sso: {
      getAuthorizationUrl: vi.fn(),
      getProfileAndToken: vi.fn(),
    },
    organizations: {
      createOrganization: vi.fn(),
    },
    portal: {
      generateLink: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  }) as unknown as ReturnType<typeof createWorkOSClient>;

describe('getSsoAuthorizationUrl', () => {
  it('delegates to workos.sso.getAuthorizationUrl with correct params', () => {
    const workos = makeWorkos();
    vi.mocked(workos.sso.getAuthorizationUrl).mockReturnValue('https://sso.workos.com/auth');

    const url = getSsoAuthorizationUrl(workos, {
      connectionId: 'conn_01',
      clientId: 'client_01',
      redirectUri: 'https://app.forgentic.io/api/auth/sso/callback',
      state: 'acme',
    });

    expect(url).toBe('https://sso.workos.com/auth');
    expect(workos.sso.getAuthorizationUrl).toHaveBeenCalledWith({
      connection: 'conn_01',
      clientId: 'client_01',
      redirectUri: 'https://app.forgentic.io/api/auth/sso/callback',
      state: 'acme',
    });
  });
});

describe('exchangeSsoCode', () => {
  it('returns normalised profile from workos', async () => {
    const workos = makeWorkos();
    vi.mocked(workos.sso.getProfileAndToken).mockResolvedValue({
      profile: {
        id: 'prof_01',
        email: 'alice@acme.com',
        firstName: 'Alice',
        lastName: 'Smith',
        organizationId: 'org_01',
        connectionId: 'conn_01',
        connectionType: 'OktaSAML',
        idpId: 'idp_01',
        rawAttributes: {},
      },
      accessToken: 'at_01',
    } as never);

    const profile = await exchangeSsoCode(workos, 'code_abc', 'client_01');

    expect(profile).toEqual({
      id: 'prof_01',
      email: 'alice@acme.com',
      firstName: 'Alice',
      lastName: 'Smith',
      organizationId: 'org_01',
      connectionId: 'conn_01',
    });
  });

  it('coerces undefined organizationId to null', async () => {
    const workos = makeWorkos();
    vi.mocked(workos.sso.getProfileAndToken).mockResolvedValue({
      profile: {
        id: 'prof_02',
        email: 'bob@acme.com',
        organizationId: undefined,
        connectionId: 'conn_01',
        connectionType: 'OktaSAML',
        idpId: 'idp_01',
        rawAttributes: {},
      },
      accessToken: 'at_02',
    } as never);

    const profile = await exchangeSsoCode(workos, 'code_xyz', 'client_01');
    expect(profile.organizationId).toBeNull();
  });
});

describe('getAdminPortalLink', () => {
  it('returns portal link for sso intent', async () => {
    const workos = makeWorkos();
    vi.mocked(workos.portal.generateLink).mockResolvedValue({
      link: 'https://portal.workos.com/sso',
    } as never);

    const link = await getAdminPortalLink(workos, 'org_01', 'sso');
    expect(link).toBe('https://portal.workos.com/sso');
  });

  it('returns portal link for dsync intent', async () => {
    const workos = makeWorkos();
    vi.mocked(workos.portal.generateLink).mockResolvedValue({
      link: 'https://portal.workos.com/dsync',
    } as never);

    const link = await getAdminPortalLink(workos, 'org_01', 'dsync');
    expect(link).toBe('https://portal.workos.com/dsync');
  });
});

describe('constructScimEvent', () => {
  it('returns null for non-dsync events', async () => {
    const workos = makeWorkos();
    vi.mocked(workos.webhooks.constructEvent).mockResolvedValue({
      event: 'connection.activated',
      data: {},
    } as never);

    const result = await constructScimEvent(workos, '{}', 'sig', 'secret');
    expect(result).toBeNull();
  });

  it('returns ScimEvent for dsync.user.created', async () => {
    const workos = makeWorkos();
    vi.mocked(workos.webhooks.constructEvent).mockResolvedValue({
      event: 'dsync.user.created',
      data: {
        id: 'du_01',
        email: 'alice@acme.com',
        firstName: 'Alice',
        lastName: 'Smith',
        state: 'active',
        directoryId: 'dir_01',
        organizationId: 'org_01',
      },
    } as never);

    const result = await constructScimEvent(workos, '{}', 'sig', 'secret');
    expect(result).not.toBeNull();
    expect(result?.event).toBe('dsync.user.created');
    expect(result?.data.email).toBe('alice@acme.com');
  });

  it('extracts user from dsync.group.user_added', async () => {
    const workos = makeWorkos();
    vi.mocked(workos.webhooks.constructEvent).mockResolvedValue({
      event: 'dsync.group.user_added',
      data: {
        user: {
          id: 'du_02',
          email: 'bob@acme.com',
          firstName: 'Bob',
          lastName: null,
          state: 'active',
          directoryId: 'dir_01',
          organizationId: null,
        },
      },
    } as never);

    const result = await constructScimEvent(workos, '{}', 'sig', 'secret');
    expect(result?.event).toBe('dsync.group.user_added');
    expect(result?.data.email).toBe('bob@acme.com');
  });
});
