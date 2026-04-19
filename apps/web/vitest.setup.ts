import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// With `test.globals: false`, Testing Library's auto-cleanup (which registers
// via the globally-available `afterEach`) never wires up. Register it here so
// DOM is torn down between tests and queries like `getAllByRole` don't see
// stale renders from earlier tests in the same file.
afterEach(() => {
  cleanup();
});
