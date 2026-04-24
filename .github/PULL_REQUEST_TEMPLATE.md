<!--
Forgentic PR template. Keep PRs small, scoped, and conventional-commit titled.
Link the workstream ticket (W0-1 §G, AQ-1, etc.) so the plan stays traceable.
-->

## Summary

<!-- One paragraph: what changed and why. Link to PLAN.md section or workstream. -->

## Changes

<!-- Bulleted list of what's in the diff. Keep it terse. -->

-
-

## Workstream / ticket

<!-- e.g. `W0-1 §H` (GitHub Actions CI) or `AQ-2` (Aquila change AQ-2). -->

## Checklist

- [ ] Conventional commit title (`feat(scope): …`, `fix(scope): …`, `chore(scope): …`, `docs(scope): …`, `refactor(scope): …`, `test(scope): …`, `ci(scope): …`, `build(scope): …`, `perf(scope): …`, `revert(scope): …`). Scopes: `web`, `api`, `workers`, `db`, `auth`, `billing`, `aquila-client`, `ui`, `emails`, `telemetry`, `shared`, `infra`, `ci`, `docs`, `deps`, `tooling`.
- [ ] `pnpm lint` clean on the changed workspaces.
- [ ] `pnpm typecheck` clean on the changed workspaces.
- [ ] `pnpm test` (Vitest) clean on the changed workspaces.
- [ ] If this touches schema: migration added in `packages/db/drizzle/` and generated types updated.
- [ ] If this touches RLS-protected data: test added that proves cross-workspace denial.
- [ ] If this touches the Aquila client: the Aquila contract version pinned in the client still matches.
- [ ] Docs touched if public surface changed (`docs/ARCHITECTURE.md`, `docs/API.md`, `docs/SECURITY.md`, or a new `docs/ADR/`).
- [ ] `../PLAN.md` tracker + `../PLAN_SYNTERRA.md` updated if this closes a workstream item.

## Test plan

<!-- How did you verify it works? Commands run, UI flows exercised, data seeded, etc. -->

## Screenshots / recordings

<!-- Only if UI changes. Drop files directly here; don't link to internal hosts. -->

## Risk + rollback

<!-- What could break in prod? How do we roll this back if it does? -->

## Follow-ups

<!-- Anything deferred out of scope, linked to a new issue or entry in ../PLAN_SYNTERRA.md. -->
