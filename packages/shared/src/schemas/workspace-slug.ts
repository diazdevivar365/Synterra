// Workspace slug schema — canonical validator for tenant URL segments
// (e.g. `acme-co` in `app.forgentic.io/acme-co`). Matches the constraints
// in PLAN.md §D.2 (lowercase kebab-case, 3–32 chars).

import { z } from 'zod';

export const WorkspaceSlugSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase kebab-case');

export type WorkspaceSlug = z.infer<typeof WorkspaceSlugSchema>;
