'use client';

import { useActionState, useEffect, useRef } from 'react';

import {
  createKeyAction,
  revokeKeyAction,
  type ApiKeyRow,
  type CreateKeyState,
  type RevokeKeyState,
} from '@/actions/api-keys';

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ApiKeysClient({ keys }: { keys: ApiKeyRow[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, createAction, creating] = useActionState<CreateKeyState, FormData>(
    createKeyAction,
    null,
  );
  const [, revokeAction] = useActionState<RevokeKeyState, FormData>(revokeKeyAction, null);

  useEffect(() => {
    if (createState?.ok) formRef.current?.reset();
  }, [createState]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-fg mb-1 text-lg font-semibold">API keys</h1>
      <p className="text-muted-fg mb-8 text-sm">
        Keys grant read access to your workspace data via the Forgentic API.
      </p>

      {createState?.ok && (
        <div className="border-border mb-6 rounded-lg border p-4">
          <p className="text-fg mb-2 text-sm font-medium">
            Key created — copy it now. It won&rsquo;t be shown again.
          </p>
          <code className="bg-muted text-fg block select-all break-all rounded px-3 py-2 font-mono text-sm">
            {createState.key}
          </code>
        </div>
      )}

      {createState && !createState.ok && (
        <p className="text-destructive mb-4 text-sm">{createState.message}</p>
      )}

      <form ref={formRef} action={createAction} className="mb-8 flex gap-3">
        <input
          name="name"
          placeholder="Key name (e.g. production)"
          className="border-border bg-surface text-fg placeholder:text-muted-fg flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
          maxLength={60}
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-fg text-bg rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {keys.length === 0 ? (
        <p className="text-muted-fg text-sm italic">No API keys yet.</p>
      ) : (
        <div className="border-border rounded-lg border">
          {keys.map((key, i) => (
            <div
              key={key.id}
              className={`flex items-center gap-4 px-4 py-3${i < keys.length - 1 ? 'border-border border-b' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-fg text-sm font-medium">{key.name}</p>
                <p className="text-muted-fg font-mono text-xs">
                  {key.keyPrefix}…
                  {key.lastUsedAt ? ` · last used ${formatDate(key.lastUsedAt)}` : ' · never used'}
                </p>
              </div>
              <span className="text-muted-fg text-xs">{formatDate(key.createdAt)}</span>
              <form action={revokeAction}>
                <input type="hidden" name="keyId" value={key.id} />
                <button type="submit" className="text-destructive text-xs hover:opacity-70">
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
