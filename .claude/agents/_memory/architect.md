# architect memory

_Persistent cross-session scratchpad for the `synterra-architect` subagent._
_Append a dated entry (`## 2026-MM-DD — <title>`) after every non-trivial task._
_Read the whole file at the start of every session._

---

_(empty — first entry lands when the agent runs its first task)_

---

## 2026-04-20 — W3-1 implementation plan (Plans + Stripe integration)

Produced a 10-step, file-precise implementation plan for `synterra-billing-engineer` to execute.

**Key confirmed state at plan time:**
- `packages/billing/src/index.ts` — stub with empty PLANS array and `BillingPlan` interface. No Stripe dep yet.
- `packages/db/src/schemas/billing.ts` — Drizzle schema exists and is complete (`plans` + `subscriptions` tables). No ORM changes needed.
- `packages/db/migrations/0006_billing.sql` — only seeds `trial` plan with wrong quota value (1000 vs spec's 500); needs correction + 4 more plan rows.
- `apps/web/src/app/api/webhooks/` — only has `workos/` subfolder. No Stripe webhook route yet.
- `apps/workers/src/queues.ts` — only has `DEFAULT` and `PROVISION` queues. `stripe-events` queue missing.
- `apps/workers/src/config.ts` — zod env schema exists; needs STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET added.
- `apps/web/src/middleware.ts` — Next.js edge middleware exists; needs `past_due` injection added.
- `stripe` package NOT in pnpm-workspace.yaml catalog yet.
- Env var stubs already in `infra/lxc-app/.env.example`: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY.
- `createWorkspace()` action in `apps/web/src/actions/workspace.ts` — trial subscription insert goes after workspaceMembers insert, before logAudit call.
- WorkOS webhook at `apps/web/src/app/api/webhooks/workos/route.ts` is the exact pattern to mirror for Stripe.
