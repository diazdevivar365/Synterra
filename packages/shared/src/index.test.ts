import { describe, expect, it } from 'vitest';

import { EmailSchema, WorkspaceSlugSchema } from './index.js';

describe('@synterra/shared schemas', () => {
  it('accepts a valid kebab-case workspace slug', () => {
    expect(WorkspaceSlugSchema.parse('acme-co')).toBe('acme-co');
  });

  it('rejects an uppercase slug', () => {
    expect(() => WorkspaceSlugSchema.parse('UPPERCASE')).toThrow();
  });

  it('rejects a too-short slug', () => {
    expect(() => WorkspaceSlugSchema.parse('a')).toThrow();
  });

  it('normalises emails to lowercase on parse', () => {
    expect(EmailSchema.parse('Foo@Example.COM')).toBe('foo@example.com');
  });

  it('rejects invalid email shape', () => {
    expect(() => EmailSchema.parse('not-an-email')).toThrow();
  });
});
