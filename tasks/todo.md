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

## B. Node toolchain ✅ (2026-04-19, commit `9d0730c`)

- [x] B1 — `.nvmrc` → `22`
- [x] B2 — `.node-version` → `22` (soporta Volta/asdf además de nvm/fnm)
- [x] B3 — `package.json` raíz: `private: true`, `engines` (node 22, pnpm 10), `packageManager: "pnpm@10.33.0"`, catalog setup, scripts via turbo
- [x] B4 — `pnpm-workspace.yaml` (`apps/*`, `packages/*` + catalog versionado)
- [x] B5 — `.npmrc` (`engine-strict=true`, `strict-peer-dependencies=true`, `auto-install-peers=false`, `node-linker=isolated`)
- [x] B6 — `docs/SETUP.md` (fnm + corepack + troubleshooting playbook)
- [x] B7 — Commit `chore(tooling): pin Node 22 LTS + pnpm 10 toolchain` (`9d0730c`)

## C. Turborepo ✅ (2026-04-19, commit `f7fb3f4`)

- [x] C1 — `turbo.json` con tasks: `build` (^build chain), `dev` (persistent+interruptible), `lint`, `typecheck` (^typecheck chain), `test`, `test:e2e` (^build chain, no cache), `clean` + global deps + env allowlist
- [x] C2 — Scripts raíz ya integrados en B3 (`package.json`)
- [x] C3 — `.turbo/` ya ignorado en A3 (`.gitignore`)

## D. TypeScript base config ✅ (2026-04-19)

- [x] D1 — `packages/tsconfig/`:
  - `base.json` (strict full: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`, `moduleResolution: "Bundler"`, target ES2023)
  - `node.json` (extends base, types: `node`)
  - `next.json` (extends base, lib: `DOM + DOM.Iterable`, `jsx: preserve`, `noEmit: true`, Next plugin)
- [x] D2 — `packages/tsconfig/package.json` (`@synterra/tsconfig`, private, exports map para `./base`, `./node`, `./next`)
- [x] D3 — `turbo.json` globalDependencies actualizado para trackear `packages/tsconfig/*.json`

## E. Linting + formatting

- [x] E1 — ESLint 9 flat config ✅ (2026-04-19) — `eslint.config.mjs` root con:
  - `typescript-eslint` v8 strict+stylistic type-checked vía `projectService` (auto-discover workspace tsconfigs)
  - `eslint-plugin-import` (resolver typescript, import/order + no-cycle + no-duplicates inline)
  - `eslint-plugin-unused-imports` (auto-fix unused imports + `^_` ignore pattern)
  - `@next/eslint-plugin-next` recommended + core-web-vitals scoped a `apps/web/**`
  - `eslint-config-prettier` al final (desactiva reglas que chocan con Prettier)
  - Overrides por ambiente: Node globals (api/workers/packages/tooling), Browser (web), test-files relax, `.d.ts` relax.
  - Root `tsconfig.json` agregado (extends `@synterra/tsconfig/node`) para que projectService tenga ancla en root.
- [x] E2 — `.prettierrc.mjs` + `.prettierignore` ✅ (2026-04-19) — 100-col/singleQuote/trailingComma=all/LF + overrides por filetype; `prettier-plugin-tailwindcss` en overrides scoped a `apps/web/**` y pinned en devDeps; ignore cubre drizzle SQL, env files, build artefacts, binaries.
- [x] E3 — `.editorconfig` ✅ (2026-04-19) — UTF-8/LF/2-space/insert_final_newline global + markdown trailing-whitespace exception + Makefile tab + CRLF para `.bat/.cmd/.ps1`.

## F. Testing

- [x] F1 — Vitest config raíz ✅ (2026-04-19) — `vitest.config.ts` con `test.projects: ['apps/*', 'packages/*']` (pattern Vitest 3), coverage v8 con reporters text+html+lcov+json-summary, mock hygiene (clearMocks/restoreMocks/mockReset), reporter CI-aware (junit+github-actions en CI).
- [x] F2 — Sanity test por workspace ✅ (2026-04-20) — tests presentes en todos los workspaces: apps/api, apps/web (health + rbac + errors), apps/workers, packages/db, auth, billing, aquila-client, shared, telemetry.
- [x] F3 — Playwright config ✅ (2026-04-19) — `tests/e2e/playwright.config.ts` production-grade: chromium + webkit + mobile-chromium, retries 2-en-CI, workers capped a 2 en CI, trace on-first-retry, screenshot+video on-failure, locale+timezone pinned, reporter github+html+junit en CI. `webServer` comentado hasta que lande apps/web.
- [x] F4 — Smoke spec ✅ (2026-04-19) — `tests/e2e/smoke.spec.ts` — dos invariantes: `/` tiene título con "Forgentic" y `GET /api/health` responde 200 JSON con `{status, version, uptime}`. Falla a propósito hasta que lande apps/web.

## G. Apps (bootables, no stubs — production-grade día 1)

- [x] G1 — `apps/web` ✅ (2026-04-19) — Next 16 App Router + React 19 RSC landing + Tailwind v4 + /api/health. Commit lands in Sección J del execution log.
- [x] G2 — `apps/api` ✅ (2026-04-19) — Hono sobre @hono/node-server, pino structured logs, secureHeaders, requestId, graceful shutdown, /v1/health. tsup → `dist/index.mjs`. Commit Sección K.
- [x] G3 — `apps/workers` ✅ (2026-04-19) — BullMQ worker (`synterra-default` queue — kebab-case porque BullMQ rechaza `:`), pino logs, graceful shutdown, node:http health sidecar en `:3002`, ioredis-mock tests. Full worker-lifecycle (job dispatch) deferred a Testcontainers en W0-4 (bullmq@5 + ioredis-mock@8 unhandled rejection incompat). Commit Sección L.

## H. Packages (typed stubs — production-grade day-1 surface) — commit Sección M

- [x] H1 — `packages/db` ✅ — drizzle-orm + postgres factory (`createDb(conn)` con `{max:10, idle_timeout:30}`, lazy); `timestamps` helper en `schema.ts`; `drizzle.config.ts` → `./src/schema.ts`.
- [x] H2 — `packages/auth` ✅ — `createAuth({databaseUrl, secret, baseUrl})` devuelve `{signIn, signOut, getSession}` tipado; todos rechazan con `Error('not yet wired — see W1-1')` usando `Promise.reject` (require-await compliant).
- [x] H3 — `packages/billing` ✅ — `BillingPlan` type + `PLANS: readonly BillingPlan[]` placeholder con pointer a PLAN.md §F.1.
- [x] H4 — `packages/aquila-client` ✅ — `createAquilaClient(config)` con contract-version runtime check (`'2026-04'`), valida `baseUrl/apiKey/orgSlug`; `AquilaClient` interface con `health/createOrg/issueApiKey/createResearchRun/listResearchRuns`; `types.ts` con `Organization/ApiKey/Paginated<T>/ResearchRun/ResearchRunStatus`.
- [x] H5 — `packages/ui` ✅ — `<Button>` shadcn-style con CVA (default/destructive/outline/ghost × sm/default/lg/icon), `cn()` util vía clsx+tailwind-merge. jsdom tests.
- [x] H6 — `packages/emails` ✅ — react-email 3 `<Welcome>` template con `{workspaceName, signInUrl}`; `renderWelcome()` helper. `src/index.ts` usa `createElement` para mantener `.ts` extension per brief.
- [x] H7 — `packages/telemetry` ✅ — `initTelemetry({serviceName, serviceVersion, otlpEndpoint, enabled})` con `@opentelemetry/sdk-node`; `enabled:false` es no-op verificado por tests.
- [x] H8 — `packages/shared` ✅ — `WorkspaceSlugSchema` (kebab-case 3-32 chars), `EmailSchema` (normalised lowercase). Re-exported.
- [x] H9 — Todos los `package.json` con `@synterra/<name>`, `private:true`, `main/types → src/index.ts`, `exports` map, scripts (lint/typecheck/test/clean), `@synterra/tsconfig: workspace:*`.

## I. Pre-commit — lefthook (workspace-aware, parallel)

- [x] I1 — `lefthook.yml` ✅ (2026-04-19) — `pre-commit` parallel: prettier (`--write --ignore-unknown` + `stage_fixed`), eslint (`--fix --max-warnings=0 --no-warn-ignored` + `stage_fixed`), typecheck-affected (`turbo --filter='...[HEAD]'` + skip en merge/rebase), test-affected (igual). Más `pre-push` full-graph (belt-and-braces).
- [x] I2 — `commit-msg` hook ✅ (2026-04-19) — `pnpm exec commitlint --edit {1}`.
- [x] I3 — `commitlint.config.cjs` ✅ (2026-04-19) — extends `@commitlint/config-conventional`; scope-enum con 18 scopes (apps: web/api/workers; packages: db/auth/billing/aquila-client/ui/emails/telemetry/shared; cross-cutting: infra/ci/docs/deps/tooling/tests/release); scope-empty=never, scope-case=kebab-case, subject-case=sentence+lower, subject-max-length=100, header-max-length=100, body-max-line-length=120, body+footer-leading-blank.
- [x] I4 — `lefthook install` en `prepare` ✅ (ya existía en el package.json desde B3).
- [x] I5 — `CONTRIBUTING.md` ✅ (2026-04-19) — prerequisites (fnm + corepack + pnpm 10.33.0), tabla de types + scopes, ejemplos good/bad, sección breaking changes, docs de hooks (pre-commit scope per comando + blocks commit?), emergency skip (`LEFTHOOK=0`, nunca `--no-verify`), troubleshooting (shallow clone + `[HEAD]`, commitlint on merges, prettier/eslint loop, CI commitlint fail), pre-PR checklist, code of conduct.

## J. CI — GitHub Actions

- [x] J1 — `.github/workflows/ci.yml` ✅ (2026-04-19) — PR/push main + workflow_dispatch; concurrency cancela runs viejos; jobs paralelos: `lint` (ESLint + prettier format:check), `typecheck`, `test` (uploads coverage + junit artefacts), `build`, `commitlint` (PR-only con env-indirection de SHAs); Node 22, pnpm 10.33.0 vía `pnpm/action-setup@v4`, cache pnpm store vía `actions/setup-node@v4`. `TURBO_TOKEN/TURBO_TEAM` pasan a env listos para activar remote cache.
- [x] J2 — `.github/workflows/e2e.yml` ✅ (2026-04-19) — Playwright job separado (chromium + webkit + mobile-chromium), cache de `~/.cache/ms-playwright` por hash de pnpm-lock, uploads de playwright-report + traces con retention 14d. **Gated `if: false` hasta que lande `apps/web`** con el `webServer` block activado en `playwright.config.ts`.
- [x] J3 — `.github/PULL_REQUEST_TEMPLATE.md` ✅ (2026-04-19) — Summary + Changes + Workstream + Checklist (conventional commit, lint/typecheck/test clean, migración + RLS test si toca schema, Aquila contract pin si toca client, docs, tasks/todo.md) + Test plan + Risk/rollback + Follow-ups.
- [x] J4 — `renovate.json` ✅ (2026-04-19) — Extends `config:recommended` + `:semanticCommits` + digest-pinning de actions; grouping por toolchain (ESLint, Vitest, Playwright, Next+React, Drizzle, commitlint); auto-merge sólo patches de devDependencies y `@types/*` minor/patch; Node/pnpm/TS major/minor manual; `vulnerabilityAlerts` + `osvVulnerabilityAlerts` on; schedule lunes 9-17 Buenos Aires.

## K. Docs stubs ✅ (2026-04-19) — commit Sección N

- [x] K1 — `docs/ARCHITECTURE.md` — control-plane/data-plane summary + Phase 0→1 trajectory.
- [x] K2 — `docs/API.md` — pointer a PLAN.md §H.1.
- [x] K3 — `docs/ONBOARDING.md` — pointer a §D + 90-s-to-wow invariant.
- [x] K4 — `docs/BILLING.md` — pointer a §F + plan structure summary.
- [x] K5 — `docs/SECURITY.md` — `security@forgentic.io` + encryption baseline + disclosure note.
- [x] K6 — `docs/RUNBOOKS/README.md` — index placeholder.

## L. Infra dir stubs ✅ (2026-04-19) — commit Sección N

- [x] L1 — `infra/docker-compose.yml` — Postgres 16.6-alpine + Redis 7.4-alpine + Mailpit. Healthchecks, ./.local-data volumes.
- [x] L2 — `infra/deploy-synterra.sh` — shebang + `set -euo pipefail` + `exit 1` (W10-1).
- [x] L3 — `infra/cloudflare/.gitkeep`
- [x] L4 — `infra/grafana-dashboards/.gitkeep`
- [x] L5 — `infra/migrations/.gitkeep`

## M. Claude Code config — .claude/ (10 agentes con prompt completo) ✅ (2026-04-19) — commit Sección O

**Referencia de patrón:** `Aquila/.claude/agents/*.md` (12 agents) — extraído vía lectura de architect + orchestrator + api-engineer como base, verificación con test-writer + security-compliance.

- [x] M0..M13 — los 10 agents landed, prompts 852-1131 palabras (todos dentro del budget 500-1500):
  - `synterra-architect.md` (opus, 999 w) — RLS + control/data-plane + ADRs
  - `synterra-orchestrator.md` (opus, 852 w) — cross-agent briefings
  - `synterra-backend-engineer.md` (sonnet, 1080 w) — Drizzle + Hono + BullMQ
  - `synterra-frontend-engineer.md` (sonnet, 1084 w) — Next 16 RSC + Tailwind v4
  - `synterra-auth-engineer.md` (sonnet, 1087 w) — better-auth + WorkOS + AQ-1 JWT
  - `synterra-billing-engineer.md` (sonnet, 1105 w) — Stripe + Lago event-sourced
  - `synterra-aquila-bridge.md` (sonnet, 1077 w) — contract AQ-1..AQ-4 + circuit breaker
  - `synterra-test-writer.md` (sonnet, 1131 w) — Vitest + Testcontainers + Playwright
  - `synterra-security-compliance.md` (sonnet, 1043 w) — write scoped a `docs/security-reviews/**`
  - `synterra-doc-keeper.md` (haiku, 965 w) — drift detection + OpenAPI regen
- `.claude/agents/_memory/` — 10 scratchpads (`architect.md`, `orchestrator.md`, `backend-engineer.md`, `frontend-engineer.md`, `auth-engineer.md`, `billing-engineer.md`, `aquila-bridge.md`, `test-writer.md`, `security-compliance.md`, `doc-keeper.md`).
- `.claude/agents/README.md` — índice de los 10.
- `.claude/settings.json` — permissions.deny sobre `.env*` reads + `rm -rf*` Bash.

## N. Synterra/CLAUDE.md ✅ (2026-04-19)

- [x] N1 — `CLAUDE.md` publicado. Layering sobre `../CLAUDE.md` con 7 invariantes no-negociables (control-plane vs data-plane hard boundary, workspace_id en toda query, Forgentic-brand-only, shared-schema + RLS, secrets-via-env, /health per service, graceful shutdown), + canonical references (PLAN.md, todo.md, lessons.md, CONTRIBUTING.md), + package naming + commit workflow + testing stance + when-you-get-stuck playbook. `scripts/check-brand.sh` agregado + gated en `.github/workflows/ci.yml` lint job.

## O. tasks/

- [x] O1 — `tasks/todo.md` (este archivo)
- [x] O2 — `tasks/lessons.md` ✅ (2026-04-19) — sembrado con 4 entries: BullMQ queue-name-colon gotcha (from this session) + 3 imported de Aquila (RLS + workspace_id, subagent specificity, tenancy-is-data-model-not-middleware). Formato append-only newest-first.

## P. Verificación de acceptance (clean clone simulation)

- [x] P1 — `pnpm install` ✅ — 430 packages resueltos en 10s (first install; subsequent 3s). Lockfile `pnpm-lock.yaml` committed.
- [x] P2 — `pnpm lint` ✅ — 11/11 workspaces green (via turbo).
- [x] P3 — `pnpm typecheck` ✅ — 11/11 workspaces green.
- [x] P4 — `pnpm test` ✅ — 39 tests passing across 11 workspaces.
- [x] P5 — `pnpm build` ✅ — 3/3 buildable workspaces green (web next build, api + workers tsup bundles).
- [x] P5b — `pnpm format:check` ✅ — Prettier baseline clean.
- [x] P5c — `scripts/check-brand.sh` ✅ — zero "Synterra" leaks in apps/web/src, apps/web/public, packages/ui/src, packages/emails/src.
- [x] P6 — Playwright smoke ✅ (2026-04-20) — webServer block habilitado en `tests/e2e/playwright.config.ts`; gate `if: false` removido de `.github/workflows/e2e.yml`. CI E2E corre en push a main + PRs.
- [x] P7 — `git push --force origin main` ✅ (2026-04-19) — 19 commits subidos, remote en `f3861ab`.
- [x] P8 — CI trigger lanzado en push ✅ (2026-04-19).

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

## Review (post-ejecución — 2026-04-19, W0-1 bootstrap sesión 2)

**Status:** 21/22 W0-1 items complete. The only open item is **P7 (push to origin + branch protection check)** which intentionally holds for live user confirmation.

**Commit map** (oldest → newest):

| Sección (user scheme) | Scope                                                                                                                                 | Commit (pre-hash)            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| A                     | Initial repo skeleton                                                                                                                 | `ece316e`                    |
| B                     | Node 22 LTS + pnpm 10 toolchain                                                                                                       | `9d0730c`                    |
| C                     | turbo.json task graph                                                                                                                 | `f7fb3f4`                    |
| D                     | `@synterra/tsconfig` shared                                                                                                           | `8d26f31`                    |
| E                     | Prettier 3 + EditorConfig                                                                                                             | `7a37ff5`                    |
| F                     | ESLint 9 flat config                                                                                                                  | `ada5721`                    |
| G                     | Vitest 3 + Playwright baseline                                                                                                        | `dc864bf`                    |
| H                     | GitHub Actions CI + Renovate                                                                                                          | `e005dc9`                    |
| I                     | lefthook + commitlint + CONTRIBUTING                                                                                                  | `33b5f6e`                    |
| (tooling)             | `pnpm.onlyBuiltDependencies`                                                                                                          | `05800b0`                    |
| J                     | apps/web RSC landing                                                                                                                  | `fd9fdd5`                    |
| K                     | apps/api Hono service                                                                                                                 | `2589e15`                    |
| L                     | apps/workers BullMQ                                                                                                                   | `f76af2f`                    |
| M                     | 8 `@synterra/*` packages                                                                                                              | `9f90d30`                    |
| N                     | docs + infra stubs                                                                                                                    | `8f72e6e`                    |
| O                     | 10-agent Synterra team                                                                                                                | `acfbfe8`                    |
| (post-scaffold)       | Prettier pass + peer deps + pino typing + lefthook eslint via turbo + commitlint subject-case disabled + brand-check + CLAUDE/lessons | `4d7624c`                    |
| P (release)           | `chore(release): W0-1 green baseline` — acceptance run 36/36                                                                          | _this commit_                |
| P7 (pending)          | `git push -u origin main`                                                                                                             | _awaiting live confirmation_ |

**What surprised us (captured in `tasks/lessons.md`):**

1. BullMQ rejects `:` in queue names — blew up all three worker tests on the first run. Fix: kebab-case + regression invariant test.
2. `eslint-import-resolver-typescript` under pnpm's isolated node_linker can't resolve `@synterra/tsconfig` when eslint runs from the repo root with staged-file arguments. Fix: lefthook pre-commit eslint now runs via `pnpm turbo run lint --filter='...[HEAD]'`, which invokes eslint with each workspace as cwd.
3. Vitest `test.globals: false` disables testing-library's auto-cleanup — the `afterEach(cleanup)` needs manual registration in `vitest.setup.ts`.
4. commitlint's `subject-case: ['sentence-case','lower-case']` butchers framework names (Next, RSC, BullMQ). Relaxed to `[0]` with justification comment.

**What we deferred (filed, not forgotten):**

- Playwright smoke against running web server → W0-4 (Testcontainers + webServer block).
- Full BullMQ worker integration testing → W0-4 (real Redis 7 via Testcontainers).
- Turbo remote cache → activates when `TURBO_TOKEN/TURBO_TEAM` repo secrets land.
- Subagent F2 sanity tests per workspace → folded into §G + §H scaffolding.

**Acceptance criteria met:**

- `pnpm install && pnpm build && pnpm test` all green on the current tree.
- Lint + typecheck + format + brand-check all green.
- 10 Synterra subagents with prompts 852–1131 words each, `_memory/` scratchpads provisioned.
- Pre-commit + commit-msg + pre-push hooks wired and exercised on a real commit.
- CI workflow defined (lint + typecheck + test + build + commitlint + brand-check); will go live on first push.

**What's blocking W0-2:**

Nothing. The moment the user confirms the origin push (P7), W0-2 (Drizzle scaffold + migrations 0001–0012) can start against this baseline.

---

# W0-2 — Postgres setup + Drizzle scaffold ✅ (2026-04-19, commit `f698042`)

**Workstream:** Synterra/docs/plan-parts/PLAN_05_Execution_and_Appendix.md → W0-2
**Definition of done:** `pnpm db:migrate` applies cleanly; integration test verifies RLS.

- [x] Define `packages/db/` with Drizzle config (`drizzle.config.ts`, `out: ./migrations`)
- [x] Migrations 0000–0012 (extensions, users, workspaces, memberships, invites, aquila-credentials, billing, usage, quota, audit, notifications, public-api-keys, webhooks)
- [x] Domain schemas in `src/schemas/<domain>.ts` (11 files) + `timestamps.ts` helper
- [x] `withWorkspaceContext` helper + `serviceRoleQuery` escape hatch in `src/context.ts`
- [x] `scripts/migrate.ts` — idempotent runner (tracks applied in `_synterra_migrations`)
- [x] `package.json`: `db:migrate` script + `tsx` devDep
- [x] PLAN.md split into `docs/plan-parts/` (5 files) to avoid context bloat
- [ ] Integration test: RLS cross-workspace denial — **deferred to W0-4** (requires real Postgres via Testcontainers; same pattern as BullMQ deferral in W0-1)

**typecheck ✅ 11/11 | test ✅ 11/11 (39 tests) | pre-commit hooks ✅**

---

# W0-3 — Infrastructure (LXC + Docker Compose + Cloudflare Tunnel) ✅ COMPLETE (2026-04-19)

**Workstream:** Synterra/docs/plan-parts/PLAN_05_Execution_and_Appendix.md → W0-3
**Definition of done:** Stack deployed on 5 LXCs, 13 migrations applied, reachable publicly via Cloudflare tunnel. ✅ MET

**Domain note:** Domain is `forgentic.io` (not `.app`). All config files updated accordingly.

## Deliverables (files)

- [x] `infra/bootstrap-lxc.sh` — first-boot provisioner for all 5 LXC roles.
- [x] `infra/deploy-synterra.sh` — full deploy script: Infisical auth → secrets → build → compose up → migrate.
- [x] `infra/.env.example` — complete secret reference map (30+ vars, updated to forgentic.io).
- [x] `infra/cloudflare/tunnel.yml` — Cloudflare Tunnel ingress: `app.forgentic.io`, `dev.forgentic.io`, `api.forgentic.io` → Traefik.
- [x] `infra/lxc-app/docker-compose.yml` — `traefik:latest` + 3 Next.js replicas + 2 BullMQ workers + cloudflared + Alloy + Promtail. `Host(\`app.forgentic.io\`) || Host(\`dev.forgentic.io\`)`hardcoded (env had`https://` scheme).
- [x] `infra/lxc-app/traefik/traefik.yml` — static config (empty `certificatesResolvers: {}` removed — Traefik v3 rejects it).
- [x] `infra/lxc-app/traefik/dynamic.yml` — TLS options, secure-headers, rate-limit-api middlewares.
- [x] `infra/lxc-app/promtail.yml` — Docker log scraper → Loki.
- [x] `infra/lxc-app/grafana-agent.river` — switched to `grafana/alloy:latest` (Grafana Agent deprecated; River config same).
- [x] `infra/lxc-db/docker-compose.yml` — Postgres 16 + WAL + pg_basebackup + rclone B2 + exporters.
- [x] `infra/lxc-cache/docker-compose.yml` — Redis 7 `noeviction` (committed + restarted on LXC ✅).
- [x] `infra/lxc-metering/docker-compose.yml` — Full Lago v1.32 stack.
- [x] `infra/lxc-observability/docker-compose.yml` — Prometheus + Loki + Tempo + Grafana + Alertmanager + Cachet + node-exporter (updated to forgentic.io).
- [x] `infra/lxc-observability/config/prometheus.yml` — scrape targets.
- [x] `infra/lxc-observability/config/alertmanager.yml` — email alerts (updated to forgentic.io).
- [x] `infra/lxc-observability/config/loki.yml` — TSDB schema, 14d retention.
- [x] `infra/lxc-observability/config/tempo.yml` — OTLP ingestion, 14d retention, service-graphs + span-metrics.
- [x] `infra/lxc-observability/config/grafana-datasources.yml` — Prometheus + Loki + Tempo + Alertmanager with exemplar trace links.
- [x] `packages/db/migrations/0002_workspaces.sql` — RLS forward-ref to `workspace_members` moved to 0003.
- [x] `packages/db/migrations/0003_memberships.sql` — workspace RLS policies added here.
- [x] `packages/db/migrations/0007_usage.sql` — `idempotency_key UNIQUE` replaced with partial index including partition key `created_at`.
- [x] `apps/web/next.config.mjs` — `output: 'standalone'` added.
- [x] `apps/web/Dockerfile` — multi-stage, standalone output, `127.0.0.1` healthcheck.
- [x] `apps/workers/Dockerfile` — restructured runner: dist at `apps/workers/dist/` so Node resolves workspace `node_modules`.
- [x] `apps/api/Dockerfile` — tsup-bundled runner, port 3001, healthcheck at `/v1/health`. ✅ Created 2026-04-19.

## Operational steps ✅ ALL DONE

- [x] 5 LXCs created on Proxmox and bootstrapped.
- [x] Infisical Machine Identity registered → `/etc/forgentic/deploy.secret` filled on forgentic-app.lan.
- [x] Cloudflare Tunnel `forgentic-prod` created → TUNNEL_TOKEN in Infisical.
- [x] `deploy-synterra.sh` run on forgentic-app.lan → all containers healthy (`docker ps`: web×3 + workers×2 + Traefik + Alloy + Promtail).
- [x] 13 DB migrations applied on forgentic-db.lan (0000–0012, `Migrations complete.`).
- [x] `https://app.forgentic.io/api/health` → `{"status":"ok","version":"0.0.0","uptime":27.8}` ✅ live from internet.
- [x] `https://dev.forgentic.io/api/health` → same ✅ live from internet.
- [x] Cloudflare tunnel `forgentic-prod` → 4 connections (ams06/ams07/ams15/ams19).
- [x] Cloudflare WAF custom rule `(ip.src ne 213.93.60.42) → Block` — applied ✅ (confirmed 2026-04-19).
- [x] Redis `noeviction` — container restarted on forgentic-cache.lan ✅ (confirmed 2026-04-19).

## LXC map

| Role          | Hostname                    | IP            |
| ------------- | --------------------------- | ------------- |
| App           | forgentic-app.lan           | 192.168.10.52 |
| DB            | forgentic-db.lan            | 192.168.10.50 |
| Cache         | forgentic-cache.lan         | 192.168.10.51 |
| Metering      | forgentic-metering.lan      | 192.168.10.53 |
| Observability | forgentic-observability.lan | 192.168.10.54 |

## Bugs fixed during deploy (captured in tasks/lessons.md)

1. `traefik:v3.3` incompatible with Docker Engine 28 (API 1.24 dropped) → pinned to `traefik:latest`.
2. `DOCKER_API_VERSION` env ignored by Traefik (doesn't use `client.FromEnv`).
3. `grafana/agent` deprecated → `grafana/alloy:latest`.
4. `certificatesResolvers: {}` breaks Traefik v3 YAML parser → removed.
5. Workers dist path — tsup output at `/app/dist/`, Node couldn't find `apps/workers/node_modules` → restructured to `apps/workers/dist/`.
6. Healthchecks with `localhost` → Alpine resolves `::1` first, Node binds IPv4 → use `127.0.0.1`.
7. Migration 0002 forward-referenced `workspace_members` → moved RLS policies to 0003.
8. `idempotency_key UNIQUE` on partitioned table requires partition key in index.
9. Traefik `Host()` rule received `https://app.forgentic.app` (wrong domain + scheme) → hardcoded.
10. cloudflared → `http://traefik:80` caused redirect loop → changed to `https://traefik:443` + No TLS Verify.

---

# W0-4 — Observability Bootstrap (OTel + Traces + Metrics) ✅ COMPLETE (2026-04-19)

**Workstream:** Synterra/docs/plan-parts/PLAN_05_Execution_and_Appendix.md → W0-4
**Definition of done:** Traces visible in Grafana Tempo; Prometheus scrapes worker metrics; Pino logs include traceId/spanId.

## Deliverables

- [x] `apps/api/Dockerfile` — ✅ Done (W0-3)
- [x] `apps/web/src/instrumentation.ts` — OTel SDK via `@synterra/telemetry` + Next.js `register()` hook (Node runtime only)
- [x] `apps/workers/src/worker.ts` — OTel spans on BullMQ job execution via `tracer.startActiveSpan`
- [x] `apps/api/src/index.ts` + `apps/workers/src/index.ts` — `initTelemetry` wired at boot; `shutdownTelemetry` in workers graceful shutdown
- [x] Pino `mixin: otelMixin` in `createLogger()` for api + workers (web inherits via SDK); injects `traceId`/`spanId` when a span is active
- [x] `packages/telemetry` — upgraded: `OTLPTraceExporter` wired to `NodeSDK`; `otelMixin()` exported for pino; `shutdownTelemetry` exported
- [x] Prometheus `/metrics` endpoint — `prom-client` `collectDefaultMetrics` + `/metrics` route in workers health sidecar (port 3002)
- [x] RLS cross-workspace denial integration test — `packages/db/src/rls.integration.test.ts` (Testcontainers Postgres 16; run with `pnpm --filter @synterra/db test:integration`)
- [x] Full BullMQ worker integration test — `apps/workers/src/worker.integration.test.ts` (Testcontainers Redis 7; run with `pnpm --filter @synterra/workers test:integration`)
- [x] Verify traces appear in Grafana Tempo ✅ (2026-04-20) — `OTEL_EXPORTER_OTLP_ENDPOINT=http://192.168.10.54:4318` en Infisical + redeploy lxc-app aplicado. W0-4 COMPLETO.

## Notes

- Auto-instrumentations omitted: tsup-bundled ESM breaks require-hook patching. Spans created manually at job level. HTTP spans require future W-series work with an init-loader approach.
- Integration tests excluded from default `pnpm test` run (need Docker). Add `if: ${{ env.DOCKER_AVAILABLE }}` gate when CI Docker support lands.
- `pnpm-workspace.yaml` catalog updated: added `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/auto-instrumentations-node`, `prom-client`, `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/redis`.

---

# W1-1 — better-auth integration ✅ COMPLETE (2026-04-20)

**Workstream:** Synterra/docs/plan-parts/PLAN_05_Execution_and_Appendix.md → W1-1
**Definition of done:** Full sign-up via magic link works on dev; session persists across restarts. ✅ MET

## Prerequisites ✅

- [x] Migration 0013 applied on forgentic-db.lan — `ba_session`, `ba_account`, `ba_verification` tables live; `users.email_verified` → `BOOLEAN NOT NULL DEFAULT false` (2026-04-20)
- [x] `pnpm-workspace.yaml` catalog: `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.4` (satisfies better-auth 1.6.5 peer dep), `better-auth ^1.6.5` added (2026-04-20)

## Deliverables ✅

- [x] `packages/auth/src/server.ts` — better-auth with drizzle adapter, magic-link plugin, optional Google/GitHub social providers, Resend email (dev: console.info)
- [x] `packages/auth/src/env.ts` — zod env parser (`BETTER_AUTH_SECRET/URL/DATABASE_URL`, optional social/resend keys)
- [x] `apps/web/src/app/api/auth/[...all]/route.ts` — better-auth Next.js handler
- [x] `apps/web/src/app/(auth)/sign-in/page.tsx` + `_actions.ts` — magic-link Server Action
- [x] `apps/web/src/app/(auth)/verify/page.tsx` — post-link landing
- [x] Acceptance: magic-link flow verified on `https://app.forgentic.io` (2026-04-20)

---

# W1-2 — Workspace management UI ✅ COMPLETE (2026-04-20)

**Workstream:** Synterra/PLAN.md → W1-2
**Definition of done:** Authenticated user can create/switch workspaces; settings pages (General + Members) functional.

## Deliverables ✅

- [x] Edge middleware — workspace JWT gate + `x-workspace-*` header injection (`apps/web/src/middleware.ts`) — `851466f`
- [x] `/api/workspace/switch` POST endpoint — membership check + workspace JWT cookie — `9e25c0e`
- [x] `packages/auth` — `signWorkspaceJwt` / `verifyWorkspaceJwt` (jose HS256, 8h TTL) + type exports
- [x] `/workspaces` page — picker with `WorkspaceCard` + create-workspace form — `373f77c`
- [x] `WorkspaceSwitcher` client component — ⌘K dropdown, switches via `/api/workspace/switch`
- [x] `[workspace]/layout.tsx` — sidebar (Dashboard + Settings nav) — `6eb9f36`
- [x] `[workspace]/settings/layout.tsx` — settings sub-nav (General, Members, Billing gated to owner/admin)
- [x] `getWorkspaceContext()` — reads `x-workspace-*` middleware headers
- [x] RBAC matrix `lib/rbac.ts` — 5 roles × 8 permissions + `assertCan`
- [x] Typed errors + `toActionError` (`lib/errors.ts`)
- [x] Audit log helper (`lib/audit.ts`)
- [x] `createWorkspace` + `updateWorkspaceSettings` Server Actions with audit log
- [x] Member Server Actions: `inviteMember`, `acceptInvite`, `changeMemberRole`, `removeMember`, `transferOwnership`
- [x] `[workspace]/settings/general/page.tsx` RSC + `GeneralSettingsForm` client component — `4316e74`
- [x] `[workspace]/settings/members/page.tsx` RSC + `MembersList` (list + role-change + invite) — `c215e96`
- [x] Workspace lifecycle Testcontainers integration test (5/5) + auth magic-link integration test — `9bbbfbb`

## Verification ✅ (2026-04-20)

- `pnpm typecheck` — 11/11 workspaces clean
- `pnpm test` — 49 tests passing across 11 workspaces
- `pnpm build` — all 3 buildable apps green
