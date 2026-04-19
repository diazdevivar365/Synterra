# Lessons — Forgentic (Synterra)

Append-only log of patterns we've learned the hard way. Read at session start before any non-trivial change. After each correction by the user, add an entry. Format every entry as:

```
## <date> — <short-title>

**What we tried:** …
**What went wrong:** …
**Lesson / rule:** …
**Where it applies:** …
```

Entries sorted newest-first.

---

## 2026-04-19 — BullMQ queue names reject `:`

**What we tried:** Used `synterra:default` as the BullMQ default queue name (mirroring the Aquila convention of `aquila:*` namespaces).

**What went wrong:** BullMQ 5 throws `Error: Queue name cannot contain :` the moment the `new Queue(...)` / `new Worker(...)` constructor runs, because `:` is BullMQ's internal Redis key separator. Three worker tests failed simultaneously on construction.

**Lesson / rule:** Use kebab-case (`synterra-default`, `synterra-provisioner`, `synterra-usage-aggregator`, etc.) for every BullMQ queue name. Never introduce `:` or `/` into queue identifiers. A regression test in `apps/workers/src/index.test.ts` asserts `QUEUE_NAMES.DEFAULT does not contain ':'` — extend it if we add more queues.

**Where it applies:** Any new `packages/workers/src/queues.ts` constant, any Queue/Worker constructor call, any documentation that references queue names.

---

## 2026-04-19 — Imported from Aquila — RLS + `workspace_id` discipline

**What we tried (Aquila):** Early Aquila routes omitted `org_id` from queries when the operator "knew" the context.

**What went wrong:** Cross-org data leakage in a staging test; required a 2-week remediation sweep adding `org_id` to every query.

**Lesson / rule for Synterra:** **Every** query against a workspace-scoped table includes `workspace_id` in the `WHERE` clause. Drizzle's `withWorkspaceContext` helper sets `SET LOCAL synterra.workspace_id` and wraps the operation in a transaction. No exceptions outside the explicit admin-console service-role path. Cross-workspace denial tests are mandatory for every RLS-protected table.

**Where it applies:** `packages/db/src/**`, any Server Action, any Hono route handler in `apps/api`, any BullMQ job handler that reads or writes tenant data.

---

## 2026-04-19 — Imported from Aquila — Subagent specificity beats genericity

**What we tried (Aquila):** Early Aquila had a "generic-backend" agent that handled everything from routes to workers to infra.

**What went wrong:** The generic agent produced adequate-but-bland work; reviewers couldn't tell whether Hono idioms, BullMQ patterns, or observability conventions were being respected. Quality plateaued.

**Lesson / rule for Synterra:** The 10 Synterra subagents each own a narrow surface (`synterra-backend-engineer` vs `synterra-auth-engineer` vs `synterra-aquila-bridge`). Their system prompts encode the specific patterns, gotchas, and handoff contracts for that surface. Never collapse two agents into one to "save roles" — the per-agent memory scratchpad compounds over sessions.

**Where it applies:** `.claude/agents/*`, subagent dispatch decisions, review assignments.

---

## 2026-04-19 — Imported from Aquila — `org_id` is a data-model property, not a runtime concern

**What we tried (Aquila):** Attempted to enforce tenancy at the HTTP middleware layer only, relying on routes to remember to pass `org_id` into service calls.

**What went wrong:** Any new service method that forgot to thread the context silently queried the whole table.

**Lesson / rule for Synterra:** Tenancy context (`workspace_id`) is propagated through the data layer via transaction-local Postgres settings (`SET LOCAL`), not through function parameters. RLS enforces the final barrier. Middleware remains the entry point, but is _not_ the enforcement layer. This matches Aquila's post-remediation posture.

**Where it applies:** `packages/db`, all Server Actions, `apps/api` middleware chain.

---

_(New lessons land here — newest first.)_
