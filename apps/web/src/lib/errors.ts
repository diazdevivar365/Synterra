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
