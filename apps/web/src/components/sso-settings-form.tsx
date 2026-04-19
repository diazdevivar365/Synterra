'use client';

import { useActionState, useTransition } from 'react';

import { enableSso, getAdminPortalUrl, toggleSso } from '@/actions/sso';

import type { WorkspaceRole } from '@synterra/auth';

interface Connection {
  domain: string;
  enabled: boolean;
  orgId: string;
  connectionId: string | null;
  directoryId: string | null;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  callerRole: WorkspaceRole;
  connection: Connection | null;
  ssoAvailable: boolean;
}

type SetupState = { ok: true; orgId: string } | { ok: false; message: string } | null;

export function SsoSettingsForm({
  workspaceId,
  workspaceName,
  callerRole,
  connection,
  ssoAvailable,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [setupState, setupAction] = useActionState<SetupState, FormData>(
    async (_prev, formData) => {
      const domain = formData.get('domain');
      if (typeof domain !== 'string' || !domain.trim()) {
        return { ok: false, message: 'Domain is required' };
      }
      const result = await enableSso({ workspaceId, workspaceName, domain, callerRole });
      return result.ok
        ? { ok: true, orgId: result.data.orgId }
        : { ok: false, message: result.message };
    },
    null,
  );

  function openPortal(intent: 'sso' | 'dsync') {
    startTransition(async () => {
      const result = await getAdminPortalUrl({ workspaceId, intent, callerRole });
      if (result.ok) {
        window.open(result.data.url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  function handleToggle(enabled: boolean) {
    startTransition(async () => {
      await toggleSso({ workspaceId, enabled, callerRole });
    });
  }

  if (!ssoAvailable) {
    return (
      <div className="max-w-md space-y-4">
        <h2 className="text-fg text-lg font-semibold">SSO / SAML</h2>
        <p className="text-muted-fg text-sm">
          SSO is not configured on this instance. Add{' '}
          <code className="font-mono text-xs">WORKOS_API_KEY</code> to enable.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h2 className="text-fg text-lg font-semibold">SSO / SAML</h2>
        <p className="text-muted-fg mt-1 text-sm">
          Enterprise single sign-on via SAML 2.0 powered by WorkOS.
        </p>
      </div>

      {!connection ? (
        <form action={setupAction} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="domain" className="text-fg block text-sm font-medium">
              Company email domain
            </label>
            <input
              id="domain"
              name="domain"
              type="text"
              placeholder="acme.com"
              required
              className="border-border bg-surface text-fg placeholder:text-muted-fg focus:ring-brand-500 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
            <p className="text-muted-fg text-xs">
              Users with this email domain will be directed to SSO login.
            </p>
          </div>

          {setupState && !setupState.ok && (
            <p className="text-sm text-red-400">{setupState.message}</p>
          )}
          {setupState?.ok && (
            <p className="text-sm text-green-400">
              Organization created. Configure your IdP using the button below.
            </p>
          )}

          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-500 text-fg rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Set up SSO
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="border-border space-y-2 rounded-lg border p-4">
            <Row label="Domain" value={connection.domain} mono />
            <Row
              label="Status"
              value={connection.enabled ? 'Active' : 'Inactive'}
              highlight={connection.enabled ? 'green' : 'yellow'}
            />
            <Row
              label="SAML connection"
              value={connection.connectionId ? 'Configured' : 'Not configured'}
            />
            <Row
              label="SCIM directory"
              value={connection.directoryId ? 'Connected' : 'Not connected'}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPortal('sso')}
              disabled={isPending}
              className="border-border bg-surface hover:bg-surface/80 text-fg rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50"
            >
              Configure SAML IdP →
            </button>
            <button
              type="button"
              onClick={() => openPortal('dsync')}
              disabled={isPending}
              className="border-border bg-surface hover:bg-surface/80 text-fg rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50"
            >
              Configure SCIM →
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleToggle(!connection.enabled)}
              disabled={isPending || !connection.connectionId}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                connection.enabled
                  ? 'border-border bg-surface text-fg border hover:text-red-400'
                  : 'bg-brand-600 hover:bg-brand-500 text-fg'
              }`}
            >
              {connection.enabled ? 'Disable SSO' : 'Enable SSO'}
            </button>
            {!connection.connectionId && (
              <p className="text-muted-fg text-xs">Configure SAML IdP first to enable</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: 'green' | 'yellow';
}) {
  const valueClass = highlight
    ? highlight === 'green'
      ? 'text-green-400'
      : 'text-yellow-400'
    : 'text-muted-fg';

  return (
    <div className="flex items-center justify-between">
      <span className="text-fg text-sm font-medium">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} ${valueClass}`}>{value}</span>
    </div>
  );
}
