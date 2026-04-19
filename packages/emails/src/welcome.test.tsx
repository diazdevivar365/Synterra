import { describe, expect, it } from 'vitest';

import { renderWelcome } from './index.js';

describe('<Welcome> email', () => {
  it('renders workspace name and sign-in URL into the HTML', async () => {
    const html = await renderWelcome({
      workspaceName: 'Acme Co',
      signInUrl: 'https://app.forgentic.io/sign-in',
    });
    expect(html).toContain('Acme Co');
    expect(html).toContain('https://app.forgentic.io/sign-in');
  });
});
