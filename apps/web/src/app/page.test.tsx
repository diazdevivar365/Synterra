import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('<HomePage />', () => {
  it('renders a hero h1', () => {
    render(<HomePage />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
    // Hero is a multi-line heading; any non-empty text content passes.
    expect(h1.textContent.trim().length).toBeGreaterThan(10);
  });

  it('renders the detect/interpret/respond loop', () => {
    render(<HomePage />);

    const h3s = screen.getAllByRole('heading', { level: 3 });
    const titles = h3s.map((h) => h.textContent.trim());
    expect(titles).toEqual(expect.arrayContaining(['Detect', 'Interpret', 'Respond']));
  });

  it('does not leak the internal codename anywhere in the rendered output', () => {
    const { container } = render(<HomePage />);

    // Defense-in-depth: the public brand is Forgentic. The internal codename
    // must never appear in shipped HTML. CI enforces this via a repo-wide
    // grep; this test catches regressions during development.
    expect(container.innerHTML.toLowerCase()).not.toContain('synt' + 'erra');
  });

  it('mentions Forgentic in the rendered output', () => {
    const { container } = render(<HomePage />);
    expect(container.innerHTML).toMatch(/forgentic/i);
  });
});
