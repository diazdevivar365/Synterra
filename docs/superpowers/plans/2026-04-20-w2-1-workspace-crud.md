# W2-1: Workspace CRUD + Memberships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full workspace lifecycle — create, update settings, invite/accept/revoke members, change roles, transfer ownership — with all actions audit-logged and RBAC-guarded, plus the Settings → General and Settings → Members UI pages.

**Architecture:** Server Actions (Next.js `"use server"`) own all mutations; they validate the caller's session (stubbed via `getSessionOrThrow()` until W1 lands), enforce role permissions via a central RBAC matrix, write to Drizzle under `withWorkspaceContext`, and append to `audit_log`. UI is RSC with shadcn/ui-style components and Tailwind v4; client interactivity uses `useTransition` + `useActionState`.

**Tech Stack:** Next.js 16 App Router, React 19 Server Actions, Drizzle ORM (`@synterra/db`), Tailwind v4, Vitest (unit), Testcontainers Postgres (integration — `pnpm --filter @synterra/web test:integration`).

---

## File Map

| Path | Status | Responsibility |
|------|--------|---------------|
| `apps/web/src/lib/errors.ts` | **Create** | `AppError`, `ForbiddenError`, `NotFoundError`, `ConflictError` + `toActionError()` |
| `apps/web/src/lib/session.ts` | **Create** | `getSessionOrThrow()` stub — typed `RequestSession`; replaced by W1 wire-up |
| `apps/web/src/lib/rbac.ts` | **Create** | `ROLE_HIERARCHY`, `canDo(role, action)`, `assertCan(role, action)` |
| `apps/web/src/lib/audit.ts` | **Create** | `buildAuditEntry()` + `logAudit(db, entry)` helper |
| `apps/web/src/actions/workspace.ts` | **Create** | `createWorkspace`, `updateWorkspaceSettings` Server Actions |
| `apps/web/src/actions/members.ts` | **Create** | `inviteMember`, `acceptInvite`, `changeMemberRole`, `removeMember`, `transferOwnership` |
| `apps/web/src/lib/errors.test.ts` | **Create** | Unit tests for error hierarchy |
| `apps/web/src/lib/rbac.test.ts` | **Create** | Unit tests for RBAC matrix |
| `apps/web/src/lib/audit.test.ts` | **Create** | Unit tests for audit helper |
| `apps/web/src/actions/workspace.test.ts` | **Create** | Unit tests for workspace actions (mock db) |
| `apps/web/src/actions/members.test.ts` | **Create** | Unit tests for member actions (mock db) |
| `apps/web/src/actions/workspace.integration.test.ts` | **Create** | Testcontainers full lifecycle |
| `apps/web/vitest.integration.config.ts` | **Create** | Vitest config for `*.integration.test.ts` |
| `apps/web/src/app/[workspace]/layout.tsx` | **Create** | Workspace shell — validates slug, renders children |
| `apps/web/src/app/[workspace]/settings/layout.tsx` | **Create** | Settings sidebar nav |
| `apps/web/src/app/[workspace]/settings/page.tsx` | **Create** | General settings page |
| `apps/web/src/app/[workspace]/settings/members/page.tsx` | **Create** | Members list page |
| `apps/web/src/app/[workspace]/settings/members/invite/page.tsx` | **Create** | Invite form page |
| `apps/web/src/components/workspace/RoleBadge.tsx` | **Create** | Colored role chip |
| `apps/web/src/components/workspace/MemberRow.tsx` | **Create** | Table row: member + role picker + remove |
| `apps/web/src/components/workspace/InviteForm.tsx` | **Create** | Email + role invite form |
| `apps/web/src/components/workspace/GeneralSettingsForm.tsx` | **Create** | Name update form |
| `apps/web/package.json` | **Modify** | Add `test:integration` script |

---

## Task 1: Typed errors + session stub

**Files:**
- Create: `apps/web/src/lib/errors.ts`
- Create: `apps/web/src/lib/session.ts`
- Create: `apps/web/src/lib/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/errors.test.ts
import { describe, expect, it } from 'vitest';
import { AppError, ForbiddenError, NotFoundError, toActionError } from './errors.js';

describe('AppError hierarchy', () => {
  it('ForbiddenError has code=FORBIDDEN', () => {
    const e = new ForbiddenError('nope');
    expect(e.code).toBe('FORBIDDEN');
    expect(e).toBeInstanceOf(AppError);
  });

  it('NotFoundError has code=NOT_FOUND', () => {
    const e = new NotFoundError('workspace');
    expect(e.code).toBe('NOT_FOUND');
  });

  it('toActionError wraps known error', () => {
    const result = toActionError(new ForbiddenError('nope'));
    expect(result).toEqual({ ok: false, code: 'FORBIDDEN', message: 'nope' });
  });

  it('toActionError wraps unknown error with INTERNAL code', () => {
    const result = toActionError(new Error('boom'));
    expect(result).toEqual({ ok: false, code: 'INTERNAL', message: 'boom' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Synterra && pnpm --filter @synterra/web test src/lib/errors.test.ts
```
Expected: FAIL — `errors.ts` not found.

- [ ] **Step 3: Implement errors.ts**

```typescript
// apps/web/src/lib/errors.ts
export type ActionErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'INTERNAL';

export interface ActionError {
  ok: false;
  code: ActionErrorCode;
  message: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ActionErrorCode,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export function toActionError(err: unknown): ActionError {
  if (err instanceof AppError) {
    return { ok: false, code: err.code, message: err.message };
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return { ok: false, code: 'INTERNAL', message };
}
```

- [ ] **Step 4: Create session stub**

```typescript
// apps/web/src/lib/session.ts
// Stub replaced when W1-1 (better-auth) lands.
import { ForbiddenError } from './errors.js';

export interface RequestSession {
  userId: string;
  email: string;
}

export async function getSessionOrThrow(): Promise<RequestSession> {
  // TODO(W1-1): replace with real better-auth getSession()
  throw new ForbiddenError('Authentication not yet wired — see W1-1');
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd Synterra && pnpm --filter @synterra/web test src/lib/errors.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd Synterra && git add apps/web/src/lib/errors.ts apps/web/src/lib/session.ts apps/web/src/lib/errors.test.ts
git commit -m "feat(web): typed AppError hierarchy + session stub (W2-1)"
```

---

## Task 2: RBAC matrix

**Files:**
- Create: `apps/web/src/lib/rbac.ts`
- Create: `apps/web/src/lib/rbac.test.ts`

Roles (ascending privilege): `guest < viewer < editor < manager < admin < owner`

Actions: `workspace:read`, `workspace:update`, `workspace:delete`, `member:invite`, `member:remove`, `member:change-role`, `ownership:transfer`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/lib/rbac.test.ts
import { describe, expect, it } from 'vitest';
import { assertCan, canDo, ROLE_HIERARCHY } from './rbac.js';
import { ForbiddenError } from './errors.js';

describe('ROLE_HIERARCHY', () => {
  it('owner > admin > manager > editor > viewer > guest', () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.manager);
    expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.editor);
    expect(ROLE_HIERARCHY.editor).toBeGreaterThan(ROLE_HIERARCHY.viewer);
    expect(ROLE_HIERARCHY.viewer).toBeGreaterThan(ROLE_HIERARCHY.guest);
  });
});

describe('canDo', () => {
  it('owner can do everything', () => {
    expect(canDo('owner', 'workspace:update')).toBe(true);
    expect(canDo('owner', 'workspace:delete')).toBe(true);
    expect(canDo('owner', 'ownership:transfer')).toBe(true);
  });

  it('admin can invite + update but not delete workspace or transfer ownership', () => {
    expect(canDo('admin', 'member:invite')).toBe(true);
    expect(canDo('admin', 'workspace:update')).toBe(true);
    expect(canDo('admin', 'workspace:delete')).toBe(false);
    expect(canDo('admin', 'ownership:transfer')).toBe(false);
  });

  it('viewer can only read', () => {
    expect(canDo('viewer', 'workspace:read')).toBe(true);
    expect(canDo('viewer', 'member:invite')).toBe(false);
  });

  it('guest cannot read workspace', () => {
    expect(canDo('guest', 'workspace:read')).toBe(false);
  });
});

describe('assertCan', () => {
  it('throws ForbiddenError when not permitted', () => {
    expect(() => assertCan('viewer', 'member:invite')).toThrow(ForbiddenError);
  });

  it('does not throw when permitted', () => {
    expect(() => assertCan('admin', 'member:invite')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Synterra && pnpm --filter @synterra/web test src/lib/rbac.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement rbac.ts**

```typescript
// apps/web/src/lib/rbac.ts
import { ForbiddenError } from './errors.js';

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'guest';

export type WorkspaceAction =
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'member:invite'
  | 'member:remove'
  | 'member:change-role'
  | 'ownership:transfer';

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  editor: 40,
  viewer: 20,
  guest: 0,
};

const PERMISSIONS: Record<WorkspaceAction, WorkspaceRole[]> = {
  'workspace:read': ['viewer', 'editor', 'manager', 'admin', 'owner'],
  'workspace:update': ['admin', 'owner'],
  'workspace:delete': ['owner'],
  'member:invite': ['admin', 'owner'],
  'member:remove': ['admin', 'owner'],
  'member:change-role': ['admin', 'owner'],
  'ownership:transfer': ['owner'],
};

export function canDo(role: WorkspaceRole, action: WorkspaceAction): boolean {
  return PERMISSIONS[action].includes(role);
}

export function assertCan(role: WorkspaceRole, action: WorkspaceAction): void {
  if (!canDo(role, action)) {
    throw new ForbiddenError(`Role '${role}' cannot perform '${action}'`);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd Synterra && pnpm --filter @synterra/web test src/lib/rbac.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd Synterra && git add apps/web/src/lib/rbac.ts apps/web/src/lib/rbac.test.ts
git commit -m "feat(web): RBAC permission matrix for 6 workspace roles (W2-1)"
```

---

## Task 3: Audit log helper

**Files:**
- Create: `apps/web/src/lib/audit.ts`
- Create: `apps/web/src/lib/audit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/audit.test.ts
import { describe, expect, it } from 'vitest';
import { buildAuditEntry } from './audit.js';

describe('buildAuditEntry', () => {
  it('builds entry for a user actor', () => {
    const entry = buildAuditEntry({
      workspaceId: 'ws-1',
      actorUserId: 'u-1',
      action: 'workspace.update',
      resourceType: 'workspace',
      resourceId: 'ws-1',
      before: { name: 'Old' },
      after: { name: 'New' },
    });
    expect(entry.workspaceId).toBe('ws-1');
    expect(entry.actorUserId).toBe('u-1');
    expect(entry.actorKind).toBe('user');
    expect(entry.action).toBe('workspace.update');
    expect(entry.before).toEqual({ name: 'Old' });
    expect(entry.after).toEqual({ name: 'New' });
  });

  it('sets actorKind=system when no actorUserId', () => {
    const entry = buildAuditEntry({ workspaceId: 'ws-1', action: 'workspace.provisioned' });
    expect(entry.actorKind).toBe('system');
    expect(entry.actorUserId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Synterra && pnpm --filter @synterra/web test src/lib/audit.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement audit.ts**

```typescript
// apps/web/src/lib/audit.ts
import { auditLog } from '@synterra/db';
import type { NewAuditLogEntry, Database } from '@synterra/db';

interface BuildAuditEntryInput {
  workspaceId: string;
  actorUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export function buildAuditEntry(input: BuildAuditEntryInput): NewAuditLogEntry {
  return {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorKind: input.actorUserId ? 'user' : 'system',
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    before: input.before ?? null,
    after: input.after ?? null,
    ip: input.ip,
    userAgent: input.userAgent,
    requestId: input.requestId,
  };
}

export async function logAudit(db: Database, input: BuildAuditEntryInput): Promise<void> {
  await db.insert(auditLog).values(buildAuditEntry(input));
}
```

- [ ] **Step 4: Run tests**

```bash
cd Synterra && pnpm --filter @synterra/web test src/lib/audit.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd Synterra && git add apps/web/src/lib/audit.ts apps/web/src/lib/audit.test.ts
git commit -m "feat(web): audit log helper (W2-1)"
```

---

## Task 4: createWorkspace + updateWorkspaceSettings Server Actions

**Files:**
- Create: `apps/web/src/actions/workspace.ts`
- Create: `apps/web/src/actions/workspace.test.ts`

- [ ] **Step 1: Write the failing unit tests**

```typescript
// apps/web/src/actions/workspace.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../lib/session.js', () => ({
  getSessionOrThrow: vi.fn(),
}));

import { getSessionOrThrow } from '../lib/session.js';
import { createWorkspace, updateWorkspaceSettings } from './workspace.js';

const mockSession = { userId: 'user-1', email: 'a@b.com' };
beforeEach(() => vi.mocked(getSessionOrThrow).mockResolvedValue(mockSession));

describe('createWorkspace', () => {
  it('returns VALIDATION when name is empty', async () => {
    const result = await createWorkspace({ name: '', slug: 'my-ws' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('returns VALIDATION when slug has invalid chars', async () => {
    const result = await createWorkspace({ name: 'My WS', slug: 'My WS!' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });
});

describe('updateWorkspaceSettings', () => {
  it('returns FORBIDDEN when caller is viewer', async () => {
    const result = await updateWorkspaceSettings({
      workspaceId: 'ws-1',
      callerRole: 'viewer',
      name: 'New Name',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Synterra && pnpm --filter @synterra/web test src/actions/workspace.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement workspace.ts**

```typescript
// apps/web/src/actions/workspace.ts
'use server';

import { eq } from 'drizzle-orm';
import { createDb, withWorkspaceContext, workspaces, workspaceMembers, auditLog } from '@synterra/db';
import { WorkspaceSlugSchema } from '@synterra/shared';

import { logAudit } from '../lib/audit.js';
import { ConflictError, toActionError } from '../lib/errors.js';
import { assertCan, type WorkspaceRole } from '../lib/rbac.js';
import { getSessionOrThrow } from '../lib/session.js';

const db = createDb({ connectionString: process.env['DATABASE_URL']! });

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<ActionResult<{ workspaceId: string }>> {
  try {
    const session = await getSessionOrThrow();

    const nameTrimmed = input.name.trim();
    if (!nameTrimmed) {
      return { ok: false, code: 'VALIDATION', message: 'Name is required' };
    }

    const slugParsed = WorkspaceSlugSchema.safeParse(input.slug);
    if (!slugParsed.success) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: slugParsed.error.errors[0]?.message ?? 'Invalid slug',
      };
    }
    const slug = slugParsed.data;

    const [workspace] = await db
      .insert(workspaces)
      .values({ name: nameTrimmed, slug, aquilaOrgSlug: slug })
      .returning({ id: workspaces.id })
      .onConflictDoNothing();

    if (!workspace) throw new ConflictError(`Slug '${slug}' is already taken`);

    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: session.userId,
      role: 'owner',
    });

    await logAudit(db, {
      workspaceId: workspace.id,
      actorUserId: session.userId,
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspace.id,
      after: { name: nameTrimmed, slug },
    });

    return { ok: true, data: { workspaceId: workspace.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export interface UpdateWorkspaceSettingsInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  name?: string;
  settings?: Record<string, unknown>;
  branding?: Record<string, unknown>;
}

export async function updateWorkspaceSettings(
  input: UpdateWorkspaceSettingsInput,
): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'workspace:update');

    const updates: Partial<typeof workspaces.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) return { ok: false, code: 'VALIDATION', message: 'Name is required' };
      updates.name = name;
    }
    if (input.settings !== undefined) updates.settings = input.settings;
    if (input.branding !== undefined) updates.branding = input.branding;

    await withWorkspaceContext(db, { workspaceId: input.workspaceId, userId: session.userId }, async (tx) => {
      const [before] = await tx
        .select({ name: workspaces.name, settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, input.workspaceId))
        .limit(1);

      await tx.update(workspaces).set(updates).where(eq(workspaces.id, input.workspaceId));

      await logAudit(tx, {
        workspaceId: input.workspaceId,
        actorUserId: session.userId,
        action: 'workspace.updated',
        resourceType: 'workspace',
        resourceId: input.workspaceId,
        before,
        after: updates,
      });
    });

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd Synterra && pnpm --filter @synterra/web test src/actions/workspace.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd Synterra && git add apps/web/src/actions/workspace.ts apps/web/src/actions/workspace.test.ts
git commit -m "feat(web): createWorkspace + updateWorkspaceSettings Server Actions (W2-1)"
```

---

## Task 5: Member management Server Actions

**Files:**
- Create: `apps/web/src/actions/members.ts`
- Create: `apps/web/src/actions/members.test.ts`

- [ ] **Step 1: Write the failing unit tests**

```typescript
// apps/web/src/actions/members.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../lib/session.js', () => ({ getSessionOrThrow: vi.fn() }));

import { getSessionOrThrow } from '../lib/session.js';
import { changeMemberRole, removeMember, transferOwnership } from './members.js';

const mockSession = { userId: 'user-1', email: 'a@b.com' };
beforeEach(() => vi.mocked(getSessionOrThrow).mockResolvedValue(mockSession));

describe('changeMemberRole', () => {
  it('guest cannot change roles', async () => {
    const result = await changeMemberRole({
      workspaceId: 'ws-1',
      callerRole: 'guest',
      targetUserId: 'user-2',
      newRole: 'editor',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });

  it('admin cannot promote to owner', async () => {
    const result = await changeMemberRole({
      workspaceId: 'ws-1',
      callerRole: 'admin',
      targetUserId: 'user-2',
      newRole: 'owner',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

describe('removeMember', () => {
  it('viewer cannot remove members', async () => {
    const result = await removeMember({
      workspaceId: 'ws-1',
      callerRole: 'viewer',
      targetUserId: 'user-2',
      targetRole: 'editor',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

describe('transferOwnership', () => {
  it('admin cannot transfer ownership', async () => {
    const result = await transferOwnership({
      workspaceId: 'ws-1',
      callerRole: 'admin',
      newOwnerUserId: 'user-2',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Synterra && pnpm --filter @synterra/web test src/actions/members.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement members.ts**

```typescript
// apps/web/src/actions/members.ts
'use server';

import { and, eq } from 'drizzle-orm';
import { createDb, invites, withWorkspaceContext, workspaceMembers } from '@synterra/db';
import crypto from 'node:crypto';

import { logAudit } from '../lib/audit.js';
import { ForbiddenError, NotFoundError, toActionError } from '../lib/errors.js';
import { assertCan, ROLE_HIERARCHY, type WorkspaceRole } from '../lib/rbac.js';
import { getSessionOrThrow } from '../lib/session.js';
import type { ActionResult } from './workspace.js';

const db = createDb({ connectionString: process.env['DATABASE_URL']! });

export interface InviteMemberInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  email: string;
  role: WorkspaceRole;
}

export async function inviteMember(
  input: InviteMemberInput,
): Promise<ActionResult<{ inviteId: string }>> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'member:invite');

    if (ROLE_HIERARCHY[input.role] > ROLE_HIERARCHY[input.callerRole]) {
      throw new ForbiddenError('Cannot invite to a role higher than your own');
    }

    const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invite] = await db
      .insert(invites)
      .values({
        workspaceId: input.workspaceId,
        email: input.email.toLowerCase().trim(),
        role: input.role,
        invitedBy: session.userId,
        tokenHash,
        expiresAt,
      })
      .returning({ id: invites.id });

    if (!invite) throw new Error('Failed to create invite');

    await logAudit(db, {
      workspaceId: input.workspaceId,
      actorUserId: session.userId,
      action: 'member.invited',
      resourceType: 'invite',
      resourceId: invite.id,
      after: { email: input.email, role: input.role },
    });

    return { ok: true, data: { inviteId: invite.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export interface AcceptInviteInput {
  tokenHash: string;
  userId: string;
}

export async function acceptInvite(
  input: AcceptInviteInput,
): Promise<ActionResult<{ workspaceId: string }>> {
  try {
    const [invite] = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, input.tokenHash))
      .limit(1);

    if (!invite) throw new NotFoundError('invite');
    if (invite.acceptedAt) throw new ForbiddenError('Invite already accepted');
    if (invite.revokedAt) throw new ForbiddenError('Invite has been revoked');
    if (invite.expiresAt < new Date()) throw new ForbiddenError('Invite has expired');

    await db.transaction(async (tx) => {
      await tx.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: input.userId,
        role: invite.role,
        invitedBy: invite.invitedBy,
      });

      await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));

      await logAudit(tx, {
        workspaceId: invite.workspaceId,
        actorUserId: input.userId,
        action: 'member.joined',
        resourceType: 'workspace_member',
        resourceId: invite.workspaceId,
        after: { role: invite.role },
      });
    });

    return { ok: true, data: { workspaceId: invite.workspaceId } };
  } catch (err) {
    return toActionError(err);
  }
}

export interface ChangeMemberRoleInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  targetUserId: string;
  newRole: WorkspaceRole;
}

export async function changeMemberRole(input: ChangeMemberRoleInput): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'member:change-role');

    if (input.newRole === 'owner' && input.callerRole !== 'owner') {
      throw new ForbiddenError('Only an owner can promote to owner');
    }

    await withWorkspaceContext(db, { workspaceId: input.workspaceId, userId: session.userId }, async (tx) => {
      const [member] = await tx
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.targetUserId),
          ),
        )
        .limit(1);

      if (!member) throw new NotFoundError('workspace_member');

      await tx
        .update(workspaceMembers)
        .set({ role: input.newRole })
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.targetUserId),
          ),
        );

      await logAudit(tx, {
        workspaceId: input.workspaceId,
        actorUserId: session.userId,
        action: 'member.role_changed',
        resourceType: 'workspace_member',
        resourceId: input.targetUserId,
        before: { role: member.role },
        after: { role: input.newRole },
      });
    });

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export interface RemoveMemberInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  targetUserId: string;
  targetRole: WorkspaceRole;
}

export async function removeMember(input: RemoveMemberInput): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'member:remove');

    if (input.targetRole === 'owner') {
      throw new ForbiddenError('Cannot remove the workspace owner — transfer ownership first');
    }

    await withWorkspaceContext(db, { workspaceId: input.workspaceId, userId: session.userId }, async (tx) => {
      await tx
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.targetUserId),
          ),
        );

      await logAudit(tx, {
        workspaceId: input.workspaceId,
        actorUserId: session.userId,
        action: 'member.removed',
        resourceType: 'workspace_member',
        resourceId: input.targetUserId,
        before: { role: input.targetRole },
      });
    });

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export interface TransferOwnershipInput {
  workspaceId: string;
  callerRole: WorkspaceRole;
  newOwnerUserId: string;
}

export async function transferOwnership(input: TransferOwnershipInput): Promise<ActionResult> {
  try {
    const session = await getSessionOrThrow();
    assertCan(input.callerRole, 'ownership:transfer');

    await withWorkspaceContext(db, { workspaceId: input.workspaceId, userId: session.userId }, async (tx) => {
      await tx
        .update(workspaceMembers)
        .set({ role: 'admin' })
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, session.userId),
          ),
        );

      await tx
        .update(workspaceMembers)
        .set({ role: 'owner' })
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            eq(workspaceMembers.userId, input.newOwnerUserId),
          ),
        );

      await logAudit(tx, {
        workspaceId: input.workspaceId,
        actorUserId: session.userId,
        action: 'workspace.ownership_transferred',
        resourceType: 'workspace',
        resourceId: input.workspaceId,
        before: { ownerId: session.userId },
        after: { ownerId: input.newOwnerUserId },
      });
    });

    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd Synterra && pnpm --filter @synterra/web test src/actions/members.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd Synterra && git add apps/web/src/actions/members.ts apps/web/src/actions/members.test.ts
git commit -m "feat(web): member management Server Actions (W2-1)"
```

---

## Task 6: Workspace + settings shell layouts

**Files:**
- Create: `apps/web/src/app/[workspace]/layout.tsx`
- Create: `apps/web/src/app/[workspace]/settings/layout.tsx`

- [ ] **Step 1: Create workspace shell layout**

```tsx
// apps/web/src/app/[workspace]/layout.tsx
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

interface WorkspaceLayoutProps {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { workspace: slug } = await params;
  if (!slug) notFound();
  // TODO(W1-2): validate slug against session memberships
  return <>{children}</>;
}
```

- [ ] **Step 2: Create settings sidebar layout**

```tsx
// apps/web/src/app/[workspace]/settings/layout.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { label: 'General', path: 'settings' },
  { label: 'Members', path: 'settings/members' },
] as const;

interface SettingsLayoutProps {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { workspace: slug } = await params;
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-neutral-50 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Settings
        </p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              href={`/${slug}/${item.path}`}
              className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd Synterra && git add "apps/web/src/app/[workspace]/layout.tsx" "apps/web/src/app/[workspace]/settings/layout.tsx"
git commit -m "feat(web): workspace + settings shell layouts (W2-1)"
```

---

## Task 7: Settings → General page

**Files:**
- Create: `apps/web/src/components/workspace/GeneralSettingsForm.tsx`
- Create: `apps/web/src/app/[workspace]/settings/page.tsx`

- [ ] **Step 1: GeneralSettingsForm client component**

```tsx
// apps/web/src/components/workspace/GeneralSettingsForm.tsx
'use client';

import { useActionState, useTransition } from 'react';
import { updateWorkspaceSettings } from '../../actions/workspace.js';
import type { ActionResult } from '../../actions/workspace.js';
import type { WorkspaceRole } from '../../lib/rbac.js';

interface GeneralSettingsFormProps {
  workspaceId: string;
  currentName: string;
  callerRole: WorkspaceRole;
}

export function GeneralSettingsForm({ workspaceId, currentName, callerRole }: GeneralSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, dispatch] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      updateWorkspaceSettings({ workspaceId, callerRole, name: formData.get('name') as string }),
    null,
  );

  return (
    <form action={(fd) => startTransition(() => dispatch(fd))} className="max-w-md space-y-4">
      <div>
        <label htmlFor="ws-name" className="block text-sm font-medium text-neutral-700">
          Workspace Name
        </label>
        <input
          id="ws-name"
          name="name"
          type="text"
          defaultValue={currentName}
          required
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      {result && !result.ok && <p className="text-sm text-red-600">{result.message}</p>}
      {result?.ok && <p className="text-sm text-green-600">Saved.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Settings General RSC page**

```tsx
// apps/web/src/app/[workspace]/settings/page.tsx
import { GeneralSettingsForm } from '../../../components/workspace/GeneralSettingsForm.js';

interface PageProps {
  params: Promise<{ workspace: string }>;
}

export default async function GeneralSettingsPage({ params }: PageProps) {
  const { workspace: slug } = await params;
  // TODO(W1-2): load real workspace via session + slug
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">General</h1>
      <GeneralSettingsForm
        workspaceId="placeholder"
        currentName={slug}
        callerRole="owner"
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd Synterra && git add apps/web/src/components/workspace/GeneralSettingsForm.tsx "apps/web/src/app/[workspace]/settings/page.tsx"
git commit -m "feat(web): Settings → General page (W2-1)"
```

---

## Task 8: Settings → Members page + components

**Files:**
- Create: `apps/web/src/components/workspace/RoleBadge.tsx`
- Create: `apps/web/src/components/workspace/MemberRow.tsx`
- Create: `apps/web/src/components/workspace/InviteForm.tsx`
- Create: `apps/web/src/app/[workspace]/settings/members/page.tsx`
- Create: `apps/web/src/app/[workspace]/settings/members/invite/page.tsx`

- [ ] **Step 1: RoleBadge**

```tsx
// apps/web/src/components/workspace/RoleBadge.tsx
import type { WorkspaceRole } from '../../lib/rbac.js';

const COLOR: Record<WorkspaceRole, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-indigo-100 text-indigo-800',
  manager: 'bg-blue-100 text-blue-800',
  editor: 'bg-green-100 text-green-800',
  viewer: 'bg-neutral-100 text-neutral-700',
  guest: 'bg-yellow-50 text-yellow-700',
};

export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[role]}`}>
      {role}
    </span>
  );
}
```

- [ ] **Step 2: MemberRow**

```tsx
// apps/web/src/components/workspace/MemberRow.tsx
'use client';

import { useTransition } from 'react';
import { changeMemberRole, removeMember } from '../../actions/members.js';
import type { WorkspaceRole } from '../../lib/rbac.js';
import { RoleBadge } from './RoleBadge.js';

const ALL_ROLES: WorkspaceRole[] = ['guest', 'viewer', 'editor', 'manager', 'admin', 'owner'];

interface MemberRowProps {
  workspaceId: string;
  callerRole: WorkspaceRole;
  member: { userId: string; name: string | null; email: string; role: WorkspaceRole };
  isSelf: boolean;
}

export function MemberRow({ workspaceId, callerRole, member, isSelf }: MemberRowProps) {
  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (newRole: WorkspaceRole) =>
    startTransition(() => changeMemberRole({ workspaceId, callerRole, targetUserId: member.userId, newRole }));

  const handleRemove = () => {
    if (!confirm(`Remove ${member.email}?`)) return;
    startTransition(() => removeMember({ workspaceId, callerRole, targetUserId: member.userId, targetRole: member.role }));
  };

  const canEdit = callerRole !== 'viewer' && callerRole !== 'guest' && !isSelf;

  return (
    <tr className="border-b last:border-0">
      <td className="py-3 pr-4">
        <div className="text-sm font-medium">{member.name ?? member.email}</div>
        {member.name && <div className="text-xs text-neutral-500">{member.email}</div>}
      </td>
      <td className="py-3 pr-4"><RoleBadge role={member.role} /></td>
      <td className="py-3 pr-4">
        {canEdit && (
          <select
            defaultValue={member.role}
            disabled={isPending}
            onChange={(e) => handleRoleChange(e.target.value as WorkspaceRole)}
            className="rounded border px-2 py-1 text-sm"
          >
            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </td>
      <td className="py-3">
        {canEdit && member.role !== 'owner' && (
          <button onClick={handleRemove} disabled={isPending} className="text-sm text-red-600 hover:underline disabled:opacity-40">
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}
```

- [ ] **Step 3: InviteForm**

```tsx
// apps/web/src/components/workspace/InviteForm.tsx
'use client';

import { useActionState, useTransition } from 'react';
import { inviteMember } from '../../actions/members.js';
import type { ActionResult } from '../../actions/workspace.js';
import type { WorkspaceRole } from '../../lib/rbac.js';

const INVITE_ROLES: WorkspaceRole[] = ['viewer', 'editor', 'manager', 'admin'];

interface InviteFormProps {
  workspaceId: string;
  callerRole: WorkspaceRole;
}

export function InviteForm({ workspaceId, callerRole }: InviteFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, dispatch] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      inviteMember({
        workspaceId,
        callerRole,
        email: formData.get('email') as string,
        role: formData.get('role') as WorkspaceRole,
      }),
    null,
  );

  return (
    <form action={(fd) => startTransition(() => dispatch(fd))} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="invite-email" className="block text-sm font-medium text-neutral-700">Email</label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="teammate@example.com"
          className="mt-1 block rounded-md border px-3 py-2 text-sm shadow-sm"
        />
      </div>
      <div>
        <label htmlFor="invite-role" className="block text-sm font-medium text-neutral-700">Role</label>
        <select id="invite-role" name="role" defaultValue="editor" className="mt-1 block rounded-md border px-3 py-2 text-sm shadow-sm">
          {INVITE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <button type="submit" disabled={isPending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {isPending ? 'Sending…' : 'Send invite'}
      </button>
      {result && !result.ok && <p className="text-sm text-red-600">{result.message}</p>}
      {result?.ok && <p className="text-sm text-green-600">Invite sent!</p>}
    </form>
  );
}
```

- [ ] **Step 4: Members RSC page**

```tsx
// apps/web/src/app/[workspace]/settings/members/page.tsx
import { InviteForm } from '../../../../components/workspace/InviteForm.js';
import { MemberRow } from '../../../../components/workspace/MemberRow.js';

interface PageProps {
  params: Promise<{ workspace: string }>;
}

export default async function MembersPage({ params }: PageProps) {
  await params;
  // TODO(W1-2): load members from DB via session context
  const placeholderMembers = [
    { userId: 'user-1', name: 'You', email: 'you@example.com', role: 'owner' as const },
  ];
  const callerRole = 'owner' as const;
  const workspaceId = 'placeholder';
  const currentUserId = 'user-1';

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Members</h1>
      <InviteForm workspaceId={workspaceId} callerRole={callerRole} />
      <table className="mt-8 w-full">
        <thead>
          <tr className="text-left text-sm font-semibold text-neutral-500">
            <th className="pb-2 pr-4">Member</th>
            <th className="pb-2 pr-4">Role</th>
            <th className="pb-2 pr-4">Change role</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {placeholderMembers.map((m) => (
            <MemberRow
              key={m.userId}
              workspaceId={workspaceId}
              callerRole={callerRole}
              member={m}
              isSelf={m.userId === currentUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Invite standalone page**

```tsx
// apps/web/src/app/[workspace]/settings/members/invite/page.tsx
import { InviteForm } from '../../../../../components/workspace/InviteForm.js';

interface PageProps {
  params: Promise<{ workspace: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  await params;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Invite a team member</h1>
      <InviteForm workspaceId="placeholder" callerRole="owner" />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd Synterra && git add apps/web/src/components/workspace/ "apps/web/src/app/[workspace]/settings/members/"
git commit -m "feat(web): Settings → Members page + member components (W2-1)"
```

---

## Task 9: Testcontainers integration test

**Files:**
- Create: `apps/web/vitest.integration.config.ts`
- Create: `apps/web/src/actions/workspace.integration.test.ts`
- Modify: `apps/web/package.json` — add `test:integration` script

- [ ] **Step 1: Add vitest integration config**

```typescript
// apps/web/vitest.integration.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
```

- [ ] **Step 2: Add test:integration to apps/web/package.json**

Open `apps/web/package.json`. In `scripts`, add:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 3: Write the integration test**

```typescript
// apps/web/src/actions/workspace.integration.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDb, workspaces, workspaceMembers } from '@synterra/db';
import { eq } from 'drizzle-orm';
import { execSync } from 'node:child_process';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env['DATABASE_URL'] = container.getConnectionUri();
  execSync('pnpm --filter @synterra/db db:migrate', {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    stdio: 'inherit',
  });
});

afterAll(async () => {
  await container.stop();
});

describe('workspace lifecycle', () => {
  it('createWorkspace creates workspace + owner member row', async () => {
    vi.doMock('../lib/session.js', () => ({
      getSessionOrThrow: () => Promise.resolve({ userId: 'integ-user-1', email: 'test@test.test' }),
    }));

    const { createWorkspace } = await import('./workspace.js');
    const result = await createWorkspace({ name: 'Acme Corp', slug: 'acme-corp' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const db = createDb({ connectionString: container.getConnectionUri() });
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, 'acme-corp'));
    expect(ws?.name).toBe('Acme Corp');

    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, ws!.id));
    expect(member?.role).toBe('owner');
    expect(member?.userId).toBe('integ-user-1');
  });

  it('duplicate slug returns CONFLICT', async () => {
    const { createWorkspace } = await import('./workspace.js');
    const result = await createWorkspace({ name: 'Acme 2', slug: 'acme-corp' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONFLICT');
  });
});
```

- [ ] **Step 4: Run integration tests (requires Docker)**

```bash
cd Synterra && pnpm --filter @synterra/web test:integration
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd Synterra && git add apps/web/vitest.integration.config.ts apps/web/src/actions/workspace.integration.test.ts apps/web/package.json
git commit -m "test(web): Testcontainers workspace lifecycle integration test (W2-1)"
```

---

## Task 10: Full verification + todo update

- [ ] **Step 1: Full test suite**

```bash
cd Synterra && pnpm test
```
Expected: all tests PASS (39+ existing + new unit tests).

- [ ] **Step 2: Typecheck**

```bash
cd Synterra && pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Lint**

```bash
cd Synterra && pnpm lint
```
Expected: 0 warnings.

- [ ] **Step 4: Update tasks/todo.md**

Append after the W0-4 section:

```markdown
---

# W2-1 — Workspace CRUD + Memberships ✅ COMPLETE

**Workstream:** Synterra/docs/plan-parts/PLAN_05_Execution_and_Appendix.md → W2-1
**Definition of done:** Full member lifecycle end-to-end; RBAC tests pass for all 6 roles; all mutations audit-logged.

- [x] Typed error hierarchy + session stub (`apps/web/src/lib/errors.ts`, `session.ts`)
- [x] RBAC permission matrix — 6 roles × 7 actions (`apps/web/src/lib/rbac.ts`)
- [x] Audit log helper (`apps/web/src/lib/audit.ts`)
- [x] `createWorkspace` + `updateWorkspaceSettings` Server Actions
- [x] `inviteMember`, `acceptInvite`, `changeMemberRole`, `removeMember`, `transferOwnership`
- [x] Settings → General UI + Settings → Members UI
- [x] `MemberRow`, `RoleBadge`, `InviteForm`, `GeneralSettingsForm` components
- [x] Testcontainers integration test — workspace creation + owner member row

**Pending (W1-2 wire-up):**
- Replace `getSessionOrThrow()` stub with real better-auth session
- Replace placeholder workspace/members in RSC pages with DB-loaded data from session
```

- [ ] **Step 5: Release commit**

```bash
cd Synterra && git add tasks/todo.md
git commit -m "chore(release): W2-1 workspace CRUD + memberships complete"
```

---

## Acceptance Criteria

- [ ] `pnpm test` green (unit tests)
- [ ] `pnpm typecheck` green — 0 TS errors
- [ ] `pnpm lint` green — 0 warnings
- [ ] `pnpm --filter @synterra/web test:integration` PASS (requires Docker)
- [ ] `assertCan('guest', 'workspace:read')` throws `ForbiddenError`
- [ ] `assertCan('owner', 'ownership:transfer')` does not throw
- [ ] Admin promoting a member to `owner` via `changeMemberRole` returns `FORBIDDEN`
- [ ] Duplicate slug returns `CONFLICT`
- [ ] `/[workspace]/settings` renders without error
- [ ] `/[workspace]/settings/members` renders without error
- [ ] All 7 mutations write a row to `audit_log`

---

## W1 dependency note

`getSessionOrThrow()` is intentionally stubbed. When W1-1 (better-auth) lands, the only files to update are:
1. `apps/web/src/lib/session.ts` — replace stub body with real better-auth call
2. RSC pages — replace `placeholderWorkspace` / `placeholderMembers` with DB-loaded data from session
3. Pass `callerRole` from the loaded membership rather than hardcoding `'owner'`

No action files or RBAC logic changes.
