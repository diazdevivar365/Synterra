import { auditLog, type Database, type NewAuditLogEntry } from '@synterra/db';

export interface BuildAuditEntryInput {
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
    actorKind: input.actorUserId ? 'user' : 'system',
    action: input.action,
    ...(input.actorUserId !== undefined && { actorUserId: input.actorUserId }),
    ...(input.resourceType !== undefined && { resourceType: input.resourceType }),
    ...(input.resourceId !== undefined && { resourceId: input.resourceId }),
    before: input.before !== undefined ? (input.before as NewAuditLogEntry['before']) : null,
    after: input.after !== undefined ? (input.after as NewAuditLogEntry['after']) : null,
    ...(input.ip !== undefined && { ip: input.ip }),
    ...(input.userAgent !== undefined && { userAgent: input.userAgent }),
    ...(input.requestId !== undefined && { requestId: input.requestId }),
  };
}

export async function logAudit(db: Database, input: BuildAuditEntryInput): Promise<void> {
  await db.insert(auditLog).values(buildAuditEntry(input));
}
