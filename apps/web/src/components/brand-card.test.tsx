import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandCard } from './brand-card';

const PROPS = {
  id: 'b1',
  name: 'Acme Corp',
  domain: 'acme.com',
  healthScore: 78,
  lastScannedAt: new Date('2026-04-20T10:00:00Z'),
  workspaceSlug: 'my-workspace',
};

describe('BrandCard', () => {
  it('renders brand name', () => {
    render(<BrandCard {...PROPS} />);
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
  it('renders domain', () => {
    render(<BrandCard {...PROPS} />);
    expect(screen.getByText('acme.com')).toBeDefined();
  });
  it('renders health score', () => {
    render(<BrandCard {...PROPS} />);
    expect(screen.getByText('78%')).toBeDefined();
  });
  it('renders monogram initials', () => {
    render(<BrandCard {...PROPS} />);
    expect(screen.getByText('AC')).toBeDefined();
  });
});
