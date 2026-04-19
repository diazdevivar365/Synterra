'use client';

import { useActionState } from 'react';

import { updateWorkspaceSettings } from '@/actions/workspace';
import type { WorkspaceRole } from '@synterra/auth';

interface GeneralSettingsFormProps {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  callerRole: WorkspaceRole;
}

type FormState = { ok: true } | { ok: false; message: string } | null;

export function GeneralSettingsForm({
  workspaceId,
  workspaceName,
  workspaceSlug,
  callerRole,
}: GeneralSettingsFormProps) {
  const canEdit = callerRole === 'owner' || callerRole === 'admin';

  const [state, action, pending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    const name = formData.get('name');
    if (typeof name !== 'string' || !name.trim()) {
      return { ok: false, message: 'Name is required' };
    }
    const result = await updateWorkspaceSettings({ workspaceId, callerRole, name });
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  }, null);

  return (
    <form action={action} className="max-w-md space-y-6">
      <div>
        <h2 className="text-fg text-lg font-semibold">General</h2>
        <p className="text-muted-fg mt-1 text-sm">Workspace name and identification.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="text-fg block text-sm font-medium">
          Workspace name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={workspaceName}
          disabled={!canEdit || pending}
          className="border-border bg-surface text-fg placeholder:text-muted-fg focus:ring-brand-500 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <label className="text-fg block text-sm font-medium">Workspace slug</label>
        <p className="border-border bg-surface text-muted-fg w-full select-all rounded-md border px-3 py-2 text-sm">
          {workspaceSlug}
        </p>
        <p className="text-muted-fg text-xs">Slug cannot be changed after creation.</p>
      </div>

      {state && !state.ok && <p className="text-sm text-red-400">{state.message}</p>}
      {state?.ok && <p className="text-sm text-green-400">Saved.</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-600 hover:bg-brand-500 text-fg rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </form>
  );
}
