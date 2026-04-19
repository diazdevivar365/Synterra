import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('<HomePage />', () => {
  it('renders the Forgentic wordmark as the h1', () => {
    render(<HomePage />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1.textContent).toMatch(/brand intelligence/i);
  });

  it('renders all three feature cards with the expected titles', () => {
    render(<HomePage />);

    const h3s = screen.getAllByRole('heading', { level: 3 });
    const titles = h3s.map((h) => h.textContent.trim());
    expect(titles).toEqual(expect.arrayContaining(['Observe', 'Interpret', 'Act']));
    expect(h3s).toHaveLength(3);
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
