'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { changeMemberRole, inviteMember, removeMember } from '@/actions/members';

import type { WorkspaceRole } from '@synterra/auth';

const ASSIGNABLE_ROLES: WorkspaceRole[] = ['admin', 'editor', 'viewer', 'guest'];

interface Member {
  userId: string;
  role: WorkspaceRole;
  email: string;
  name: string | null;
  joinedAt: Date | null;
}

interface MembersListProps {
  workspaceId: string;
  callerUserId: string;
  callerRole: WorkspaceRole;
  members: Member[];
}

export function MembersList({ workspaceId, callerUserId, callerRole, members }: MembersListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canManage = callerRole === 'owner' || callerRole === 'admin';

  function refresh() {
    router.refresh();
  }

  async function handleRoleChange(targetUserId: string, newRole: WorkspaceRole) {
    const result = await changeMemberRole({ workspaceId, callerRole, targetUserId, newRole });
    if (result.ok) refresh();
    else alert(result.message);
  }

  async function handleRemove(targetUserId: string, targetRole: WorkspaceRole) {
    if (!confirm('Remove this member?')) return;
    const result = await removeMember({ workspaceId, callerRole, targetUserId, targetRole });
    if (result.ok) refresh();
    else alert(result.message);
  }

  async function handleInvite(e: { currentTarget: HTMLFormElement; preventDefault(): void }) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const role = (form.elements.namedItem('role') as HTMLSelectElement).value as WorkspaceRole;
    const result = await inviteMember({ workspaceId, callerRole, email, role });
    if (result.ok) {
      form.reset();
      alert(`Invite sent to ${email}`);
    } else {
      alert(result.message);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-fg text-lg font-semibold">Members</h2>
        <p className="text-muted-fg mt-1 text-sm">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b">
            <th className="text-muted-fg pb-2 text-left font-medium">Member</th>
            <th className="text-muted-fg pb-2 text-left font-medium">Role</th>
            {canManage && <th className="pb-2" />}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {members.map((m) => {
            const isSelf = m.userId === callerUserId;
            return (
              <tr key={m.userId}>
                <td className="py-3">
                  <p className="text-fg font-medium">{m.name ?? m.email}</p>
                  {m.name && <p className="text-muted-fg text-xs">{m.email}</p>}
                </td>
                <td className="py-3">
                  {canManage && !isSelf && m.role !== 'owner' ? (
                    <select
                      defaultValue={m.role}
                      disabled={pending}
                      onChange={(e) => {
                        startTransition(() => {
                          void handleRoleChange(m.userId, e.target.value as WorkspaceRole);
                        });
                      }}
                      className="border-border bg-surface text-fg rounded border px-2 py-1 text-xs"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted-fg text-xs">{m.role}</span>
                  )}
                </td>
                {canManage && (
                  <td className="py-3 text-right">
                    {!isSelf && m.role !== 'owner' && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          startTransition(() => {
                            void handleRemove(m.userId, m.role);
                          });
                        }}
                        className="text-muted-fg text-xs transition-colors hover:text-red-400 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {canManage && (
        <form
          onSubmit={(e) => {
            startTransition(() => {
              void handleInvite(e);
            });
          }}
          className="space-y-3"
        >
          <h3 className="text-fg text-sm font-semibold">Invite member</h3>
          <div className="flex gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="colleague@example.com"
              className="border-border bg-surface text-fg placeholder:text-muted-fg focus:ring-brand-500 flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
            <select
              name="role"
              defaultValue="editor"
              className="border-border bg-surface text-fg rounded-md border px-3 py-2 text-sm"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="bg-brand-600 hover:bg-brand-500 text-fg rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Invite
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
