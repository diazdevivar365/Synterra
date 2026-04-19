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
