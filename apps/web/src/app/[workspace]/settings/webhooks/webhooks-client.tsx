'use client';

import { useActionState, useEffect, useRef } from 'react';

import {
  createEndpointAction,
  deleteEndpointAction,
  type CreateEndpointState,
  type DeleteEndpointState,
  type WebhookEndpointRow,
} from '@/actions/webhooks';

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function WebhooksClient({ endpoints }: { endpoints: WebhookEndpointRow[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, createAction, creating] = useActionState<CreateEndpointState, FormData>(
    createEndpointAction,
    null,
  );
  const [, deleteAction] = useActionState<DeleteEndpointState, FormData>(
    deleteEndpointAction,
    null,
  );

  useEffect(() => {
    if (createState?.ok) formRef.current?.reset();
  }, [createState]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-fg mb-1 text-lg font-semibold">Webhooks</h1>
      <p className="text-muted-fg mb-8 text-sm">
        Receive HTTP POST callbacks when events occur in your workspace.
      </p>

      {createState?.ok && (
        <div className="border-border mb-6 rounded-lg border p-4">
          <p className="text-fg mb-2 text-sm font-medium">
            Endpoint created — copy the signing secret now. It won&rsquo;t be shown again.
          </p>
          <code className="bg-muted text-fg block select-all break-all rounded px-3 py-2 font-mono text-sm">
            {createState.secret}
          </code>
          <p className="text-muted-fg mt-2 text-xs">
            Use this secret to verify the <code className="font-mono">X-Forgentic-Signature</code>{' '}
            header on incoming requests.
          </p>
        </div>
      )}

      {createState && !createState.ok && (
        <p className="text-destructive mb-4 text-sm">{createState.message}</p>
      )}

      <form ref={formRef} action={createAction} className="mb-8 flex gap-3">
        <input
          name="url"
          type="url"
          placeholder="https://your-server.com/webhook"
          className="border-border bg-surface text-fg placeholder:text-muted-fg flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-fg text-bg rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {creating ? 'Adding…' : 'Add endpoint'}
        </button>
      </form>

      {endpoints.length === 0 ? (
        <p className="text-muted-fg text-sm italic">No webhook endpoints yet.</p>
      ) : (
        <div className="border-border rounded-lg border">
          {endpoints.map((ep, i) => (
            <div
              key={ep.id}
              className={`flex items-start gap-4 px-4 py-3${i < endpoints.length - 1 ? 'border-border border-b' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-fg break-all text-sm font-medium">{ep.url}</p>
                <p className="text-muted-fg mt-0.5 text-xs">
                  {ep.eventTypes.join(', ')}
                  {ep.failureCount > 0 && (
                    <span className="text-destructive ml-2">
                      {ep.failureCount} failure{ep.failureCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-muted-fg shrink-0 text-xs">{formatDate(ep.createdAt)}</span>
              <form action={deleteAction}>
                <input type="hidden" name="endpointId" value={ep.id} />
                <button type="submit" className="text-destructive text-xs hover:opacity-70">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
