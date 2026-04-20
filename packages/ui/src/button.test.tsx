import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('<Button>', () => {
  it('renders its children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies variant-specific classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toMatch(/bg-destructive/);
  });

  it('merges a custom className through cn()', () => {
    render(<Button className="custom-class">OK</Button>);
    expect(screen.getByRole('button', { name: 'OK' }).className).toMatch(/custom-class/);
  });
});
