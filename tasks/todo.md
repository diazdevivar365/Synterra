# W0-1 — Repo + Tooling Skeleton

**Started:** 2026-04-19
**Workstream:** Synterra/PLAN.md §N Group 0 → W0-1
**Definition of done:** `pnpm install && pnpm build && pnpm test` corre verde en un clone limpio, CI verde, pre-commit hook funcional, 10 subagentes presentes.

**Decisiones cerradas (2026-04-19):**
- Git remote: `git@github.com:diazdevivar365/Forgentic.git` — Synterra/ es su propio repo, remote público = "Forgentic".
- Versiones: Node 22 LTS, pnpm 10.x (pin exacto en `packageManager`), Turborepo 2.x, Next.js 16 (GA), TypeScript 5.9.x.
- Engines pinned en `package.json`: Node `>=22 <23`, pnpm `>=10 <11`. `.nvmrc` con `22`.
- Pre-commit: **lefthook** (parallel, workspace-aware — corre lint/typecheck/test solo sobre workspaces modificados; commit-msg gate con commitlint conventional).
- Subagentes: **los 10 con prompts completos custom al stack Synterra**, production-grade día 1. Patrón de referencia: `Aquila/.claude/agents/*.md`.
- LICENSE: `UNLICENSED` (proprietary).
- Conventional commits: **SÍ desde día 1** (commitlint + lefthook `commit-msg` hook).
- Deps bot: **Renovate** (`renovate.json`), no Dependabot.
- Turbo remote cache: **deferred** (activamos al montar Vercel/self-hosted cache).
- `apps/web` CSS: **Tailwind v4**.
- Apps no son stubs — `web`/`api`/`workers` deben bootear, compilar y pasar smoke tests en W0-1.

---

## A. Git + repo init ✅ (2026-04-19, commit `ece316e`)
- [x] A1 — `git init` dentro de `Synterra/` (rama `main`)
- [x] A2 — `git remote add origin git@github.com:diazdevivar365/Forgentic.git`
- [x] A3 — `.gitignore` (Node, Next, Turbo cache, IDE, `.env*`, coverage, playwright-report, test-results)
- [x] A4 — `.gitattributes` (`* text=auto eol=lf`, binary overrides)
- [x] A5 — `LICENSE` → proprietary text "Copyright © 2026 Forgentic. All Rights Reserved."
- [x] A6 — `README.md` raíz (stack, layout, quickstart, verification contract)
- [x] A7 — `CODEOWNERS` (`* @diazdevivar365` + reglas para paths críticos)
- [x] A8 — Primer commit `chore: initial repo skeleton` (`ece316e`) — NO push aún (push al final de W0-1 verde)

## B. Node toolchain
- [ ] B1 — `.nvmrc` → `22`
- [ ] B2 — `.node-version` → `22` (soporta Volta/fnm además de nvm)
- [ ] B3 — `package.json` raíz: `private: true`, `engines`, `packageManager: "pnpm@10.x.x"` (versión exacta detectada)
- [ ] B4 — `pnpm-workspace.yaml` (`apps/*`, `packages/*`)
- [ ] B5 — `.npmrc` (`strict-peer-dependencies=true`, `auto-install-peers=false`, `node-linker=isolated`)

## C. Turborepo
- [ ] C1 — `turbo.json` con tasks: `build`, `lint`, `typecheck`, `test`, `test:e2e`, `dev` (`dev` con `persistent: true` y `cache: false`)
- [ ] C2 — Scripts raíz: `build`, `lint`, `typecheck`, `test`, `test:e2e`, `dev`, `clean`
- [ ] C3 — `.turbo/` en `.gitignore`

## D. TypeScript base config
- [ ] D1 — `packages/tsconfig/` con:
  - `base.json` (strict + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, `moduleResolution: "bundler"`)
  - `node.json` (extends base, para `apps/api`, `apps/workers`, packages Node-side)
  - `next.json` (extends base, para `apps/web`)
- [ ] D2 — `packages/tsconfig/package.json` (private, exportado por workspaces)

## E. Linting + formatting
- [ ] E1 — ESLint 9 flat config (`eslint.config.mjs` raíz) con:
  - `@typescript-eslint` v8
  - `eslint-plugin-import` (resolver typescript)
  - `eslint-plugin-unused-imports`
  - `eslint-config-next` (solo para `apps/web`)
- [ ] E2 — `.prettierrc.mjs` + `.prettierignore` (singleQuote, trailingComma all, printWidth 100, plugin tailwindcss para `apps/web`)
- [ ] E3 — `.editorconfig` (LF, utf-8, 2 spaces, insert_final_newline)

## F. Testing
- [ ] F1 — Vitest config raíz (`vitest.workspace.ts`) agregando `apps/*` y `packages/*`
- [ ] F2 — Un test sanity por workspace (asegura discovery): `apps/web`, `apps/api`, `apps/workers`, y un par de packages
- [ ] F3 — Playwright config en `tests/e2e/playwright.config.ts` (baseURL placeholder, projects: chromium + webkit + mobile-chromium)
- [ ] F4 — `tests/e2e/smoke.spec.ts` — test trivial que sólo chequea título de la home de `apps/web`

## G. Apps (bootables, no stubs — production-grade día 1)
- [ ] G1 — `apps/web` — Next 16, App Router, React 19, TS, Tailwind v4
  - `src/app/page.tsx` con landing "Forgentic" (hero real, no "coming soon"): título, tagline, footer con versión
  - `src/app/api/health/route.ts` → `{ status: 'ok', version: pkg.version, uptime: process.uptime() }` (content-type JSON, `Cache-Control: no-store`)
  - `next.config.mjs` con `transpilePackages: ['@synterra/ui', '@synterra/shared']`, `experimental.typedRoutes: true`, `reactStrictMode: true`
  - Vitest con `@testing-library/react` + jsdom: test que renderiza `<Page />` y verifica "Forgentic"
  - Test de route handler: `import { GET }` directo, assert shape `{status, version, uptime}`
  - `pnpm dev` arranca en `:3000`, `pnpm build && pnpm start` corre el bundle de producción
- [ ] G2 — `apps/api` — Hono sobre Node 22 (`@hono/node-server`)
  - `src/index.ts` con `app.get('/v1/health', ...)` → `{ status, version, uptime }`
  - Middleware baseline: `secureHeaders`, `requestId`, `logger` (structured JSON via pino)
  - Graceful shutdown (SIGTERM/SIGINT drena conexiones, timeout 10s)
  - `tsup.config.ts` bundle ESM → `dist/index.mjs`
  - Vitest: test de `/v1/health` usando `app.request('/v1/health')` (Hono testing nativo)
  - `pnpm dev` (tsx watch) arranca en `:3001`, `pnpm build && pnpm start` corre el bundle
- [ ] G3 — `apps/workers` — BullMQ worker real
  - `src/index.ts` conecta a Redis (`REDIS_URL` env, default `redis://localhost:6379`), instancia `new Worker('synterra:default', ...)` con handler noop que loggea job id
  - `src/logger.ts` pino structured logs, emite `{ event: 'worker.ready', queue, connection }` al iniciar
  - Graceful shutdown (SIGTERM: `worker.close()` + close Redis, timeout 15s)
  - Health endpoint HTTP sidecar en `:3002` (`/health` reporta estado de conexión Redis) — los workers necesitan healthcheck para K8s/Fargate
  - Vitest con `ioredis-mock`: test que el worker instancia, loggea "ready", y maneja graceful shutdown sin errores
  - `pnpm dev` (tsx watch) conecta Redis local y queda escuchando

## H. Packages (stubs)
- [ ] H1 — `packages/db` — Drizzle Kit setup + `src/index.ts` exportando un client factory vacío, `drizzle.config.ts` apuntando a `src/schema.ts` (archivo vacío `export {}`)
- [ ] H2 — `packages/auth` — `src/index.ts` con `export const auth = null as unknown` placeholder tipado
- [ ] H3 — `packages/billing` — stub vacío
- [ ] H4 — `packages/aquila-client` — stub con interfaz `AquilaClient` (sin implementación) + tipos compartidos
- [ ] H5 — `packages/ui` — `src/index.ts` con re-export de un `<Button>` shadcn sample
- [ ] H6 — `packages/emails` — React Email setup, template `welcome.tsx` placeholder
- [ ] H7 — `packages/telemetry` — OpenTelemetry SDK init stub, `export function initTelemetry(serviceName: string) {}`
- [ ] H8 — `packages/shared` — zod schemas + types compartidos, empieza con `export const WorkspaceSlugSchema = z.string().regex(...)`
- [ ] H9 — Cada package con `package.json` (`name: "@synterra/<pkg>"`, `private: true`, `main/types` a `dist/` o `src/` según corresponda)

## I. Pre-commit — lefthook (workspace-aware, parallel)
- [ ] I1 — `lefthook.yml` raíz con `pre-commit` parallel:
  - `prettier`: `prettier --write` sobre staged (`{staged_files}`)
  - `eslint`: `eslint --fix` sobre staged (`{staged_files}`)
  - `typecheck-affected`: `pnpm turbo run typecheck --filter=...[HEAD]` — solo workspaces tocados
  - `test-affected`: `pnpm turbo run test --filter=...[HEAD]` — solo workspaces tocados
  - `stage_fixed: true` para prettier+eslint
- [ ] I2 — `commit-msg` hook: `pnpm commitlint --edit {1}` (valida conventional commits)
- [ ] I3 — `commitlint.config.cjs` raíz extendiendo `@commitlint/config-conventional` + scopes enumerados (`web`, `api`, `workers`, `db`, `auth`, `billing`, `aquila-client`, `ui`, `emails`, `telemetry`, `shared`, `infra`, `ci`, `docs`, `deps`)
- [ ] I4 — `lefthook install` en `prepare` script del `package.json` raíz (no `postinstall`, para evitar fallos en CI sin git)
- [ ] I5 — Doc `Synterra/CONTRIBUTING.md` con ejemplo de commit conventional válido + troubleshooting lefthook

## J. CI — GitHub Actions
- [ ] J1 — `.github/workflows/ci.yml`:
  - Trigger: PR a main, push a main
  - Jobs: `lint`, `typecheck`, `test`, `build` (en paralelo donde se pueda)
  - Node 22, pnpm via `pnpm/action-setup@v4`, cache `~/.pnpm-store`
  - Turbo remote cache deferred (TODO comment para cuando montemos Vercel/self-hosted)
- [ ] J2 — `.github/workflows/e2e.yml` — Playwright en job separado con `pnpm exec playwright install --with-deps chromium`
- [ ] J3 — `.github/PULL_REQUEST_TEMPLATE.md` (checklist mínimo)
- [ ] J4 — `renovate.json` raíz (pnpm monorepo preset, grouping de minor/patch, semana laboral, auto-merge para patches + devDependencies)

## K. Docs stubs
- [ ] K1 — `docs/ARCHITECTURE.md` (1 párrafo + link a `PLAN.md`)
- [ ] K2 — `docs/API.md` (placeholder "see §H once W6 lands")
- [ ] K3 — `docs/ONBOARDING.md` (placeholder)
- [ ] K4 — `docs/BILLING.md` (placeholder)
- [ ] K5 — `docs/SECURITY.md` (placeholder + security contact)
- [ ] K6 — `docs/RUNBOOKS/README.md` (index vacío)

## L. Infra dir stubs
- [ ] L1 — `infra/docker-compose.yml` — Postgres 16, Redis 7, Mailpit (dev SMTP) — **local dev only**
- [ ] L2 — `infra/deploy-synterra.sh` — header comment "modeled on Aquila/Backend/infra/deploy-aquila.sh — filled in W10-1"
- [ ] L3 — `infra/cloudflare/.gitkeep`
- [ ] L4 — `infra/grafana-dashboards/.gitkeep`
- [ ] L5 — `infra/migrations/.gitkeep`

## M. Claude Code config — .claude/ (los 10 agentes con prompt completo)
**Referencia de patrón y nivel de detalle:** `Aquila/.claude/agents/*.md` — leer antes de escribir cada uno para asegurar paridad de calidad.

- [ ] M0 — Leer los 10 agentes de Aquila como referencia, extraer el patrón común (frontmatter + system prompt + responsabilidades + memoria + outputs esperados + contratos de handoff)
- [ ] M1 — `.claude/settings.json` — project-scoped (hooks mínimos: safety-guard lectura de `.env*`)
- [ ] M2 — `synterra-architect.md` (opus) — FULL. Responsabilidades: decisiones de arquitectura, RLS reviews, enforcement de la separación data-plane/control-plane, ADRs en `docs/ADR/`, tradeoffs Phase 0↔Phase 1. Reads: `PLAN.md`, `packages/db/src/schema.ts`, `docs/ADR/`, `_memory/architect.md`.
- [ ] M3 — `synterra-orchestrator.md` (opus) — FULL. Briefings cross-agente: antes de despachar cualquier tarea no-trivial, lee `_memory/*.md` de los agentes involucrados y arma un briefing con contexto compartido + assumptions + handoff points. Coordina paralelización.
- [ ] M4 — `synterra-backend-engineer.md` (sonnet) — FULL. Stack: Drizzle + Postgres 16 + Hono + BullMQ + Next.js Server Actions. Reglas: nunca query sin `workspace_id` en `WHERE`, usar transactions `db.transaction` para multi-tabla, zod en boundary, errors tipados, BullMQ con retry/backoff explicit.
- [ ] M5 — `synterra-frontend-engineer.md` (sonnet) — FULL. Stack: Next.js 16 App Router, React 19 RSC, shadcn/ui, Tailwind v4, TanStack Query para client state, nuqs para URL state, React Hook Form + zod para forms. Reglas: server components default, "use client" solo si necesitás hooks/state, streaming con Suspense, error boundaries per-route.
- [ ] M6 — `synterra-auth-engineer.md` (sonnet) — FULL. Stack: better-auth + WorkOS SSO proxy, JWT issuance para Aquila service tokens (AQ-1 contract), RBAC three-layer (workspace role → resource policy → row-level), session management, magic links, OAuth providers. Reglas: nunca hardcodear secrets, todos los tokens via env, rotation strategy.
- [ ] M7 — `synterra-billing-engineer.md` (sonnet) — FULL. Stack: Stripe (customer/subscription/payment intent) + Lago self-hosted (metering/events/usage-based billing), webhook handlers idempotentes, quota enforcement pre-action, invoice reconciliation. Reglas: event sourcing para usage, nunca decrementar quota sin tx, currency USD primary.
- [ ] M8 — `synterra-aquila-bridge.md` (sonnet) — FULL. Stack: `@synterra/aquila-client` typed HTTP client, JWT exchange flow (AQ-1), SSE streaming (AQ-2), usage aggregation (AQ-3). Reglas: nunca importar código Aquila directo, versión del contract chequeada en client init, retries con idempotency-key, circuit breaker.
- [ ] M9 — `synterra-test-writer.md` (sonnet) — FULL. Stack: Vitest (unit) + Testcontainers (integration con Postgres+Redis real) + Playwright (E2E). Énfasis: tests de RLS que prueban cross-workspace denial, tests de quota enforcement, tests de webhook idempotency, smoke E2E de signup → 90-second-to-wow flow.
- [ ] M10 — `synterra-security-compliance.md` (sonnet, read-only) — FULL. Revisa: RLS policies en cada schema change, secret leaks (env files, logs, commits), headers HTTP, rate limits, audit trail completeness, GDPR data export/delete flows, SOC2 prep checklist. Outputs: reporte markdown con severity por hallazgo.
- [ ] M11 — `synterra-doc-keeper.md` (haiku) — FULL. Mantiene `docs/` alineado con el código: ARCHITECTURE.md cuando cambia topology, API.md cuando cambian route handlers, BILLING.md cuando cambian planes, RUNBOOKS cuando nacen incidentes. Regenera OpenAPI spec desde Hono app.
- [ ] M12 — `.claude/agents/_memory/` dir + un `.md` vacío por cada agente (`architect.md`, `orchestrator.md`, etc) — memoria persistente cross-sesión de cada uno
- [ ] M13 — Verificación: los 10 agentes tienen frontmatter (`name`, `description`, `model`, `tools`), system prompt >= 500 palabras, sección "Success criteria", sección "Handoff contracts", sección "Memory"

## N. Synterra/CLAUDE.md
- [ ] N1 — Archivo específico de Synterra con: referencias a `../CLAUDE.md` (workflow base), `PLAN.md` (spec) y `tasks/todo.md` (tracker), convenciones de naming (`@synterra/*`), reglas de RLS (ningún query sin `workspace_id`), checklist de PR.

## O. tasks/
- [x] O1 — `tasks/todo.md` (este archivo)
- [ ] O2 — `tasks/lessons.md` — sembrar con 3 lessons imported de Aquila (RLS, org_id, subagent specificity) + sección vacía "New"

## P. Verificación de acceptance (clean clone simulation)
- [ ] P1 — `rm -rf node_modules .turbo apps/*/node_modules packages/*/node_modules && pnpm install`
- [ ] P2 — `pnpm lint` — verde
- [ ] P3 — `pnpm typecheck` — verde
- [ ] P4 — `pnpm test` — verde (vitest unit)
- [ ] P5 — `pnpm build` — verde (turbo build cacheable)
- [ ] P6 — `pnpm exec playwright install chromium && pnpm test:e2e` — verde (smoke test contra dev server de web)
- [ ] P7 — Commit `chore: green baseline` + `git push -u origin main` (primer push al repo Forgentic)
- [ ] P8 — Trigger CI manual en GitHub Actions, confirmar verde

---

## Decisiones cerradas (2026-04-19)
1. ✅ LICENSE: `UNLICENSED` (proprietary)
2. ✅ Conventional commits: SÍ desde día 1, commitlint + lefthook commit-msg
3. ✅ Deps bot: Renovate
4. ✅ Turbo remote cache: deferred
5. ✅ Tailwind v4 en `apps/web`
6. ✅ Apps bootables production-grade (no stubs) — ver sección G
7. ✅ 10 subagentes con prompts completos custom (no placeholders) — ver sección M
8. ✅ Lefthook workspace-aware parallel — ver sección I

## Review (post-ejecución — se completa al final)
_(pendiente)_
