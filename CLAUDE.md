# Synterra (Forgentic control-plane) — CLAUDE.md

Este archivo carga convenciones específicas del **control-plane SaaS**. Hereda todo lo del root `../CLAUDE.md` (ULTRA Lean, minimal diff, verification before done).

> **Brand**: "Forgentic" es el nombre público. "Synterra" es el codename interno (namespace `@synterra/*`, PLAN.md, agent names, commit messages). Nunca sale a UI, emails, marketing, docs customer-facing.

---

## Canonical references (cargar en orden para cualquier cambio no-trivial)

1. `../CLAUDE.md` — ULTRA Lean rules del portfolio.
2. `../AGENTS.md` — team de 13 agentes + routing.
3. `../PLAN.md` — index unified + workstream tracker W0-W17 (fuente de verdad status). Protocolo: al iniciar workstream → `en curso 🔄`. Al completar → `hecha ✅`.
4. `../PLAN_SYNTERRA.md` — workstreams control-plane detalle W11-W17 + frontend handoff. Cerrar `[ ]` en el mismo PR que shippea.
5. `../PLAN_ROADMAP.md` — sprints cross-project (B/D/E/F) + invariantes + cross-refs.
6. `tasks/lessons.md` — patrones aprendidos. Leer al inicio; append al corregir.
7. `CONTRIBUTING.md` — commit convention + hooks + troubleshooting.

PRs que contradigan `PLAN_*.md` sin ADR en `docs/ADR/` → rechazados.

---

## Invariantes no-negociables

### 1. Control-plane vs data-plane = boundary duro

- **Synterra** = control plane: auth, billing, workspace CRUD, UI, in-app dashboards.
- **Aquila** = data plane: research workers, Neo4j graph, scraping, LLM enrichment.
- Comunicación vía `@synterra/aquila-client` sobre HTTP versionado. **Nunca importar código de Aquila** — ni tipos.
- Contract version pinned (`AQ-1`, `AQ-2`, `AQ-3`, `AQ-4`). Mismatch → throw at factory time.
- Nueva dependencia de Aquila → AQ-N en `../PLAN_AQUILA.md` + block PR hasta que Aquila side merge.

### 2. Cada fila tiene `workspace_id`

Multi-tenancy row-level, Postgres RLS + disciplina query-layer:

- Ninguna query omite `workspace_id` del `WHERE` salvo service-role escape hatch documentado en `packages/db/`. Reservado para admin-console read-models + cross-workspace usage aggregation.
- Drizzle helpers (`withWorkspaceContext`) envuelven transacciones → `SET LOCAL synterra.workspace_id = $1` antes del primer read/write.
- Cada tabla RLS-protected ships con cross-workspace-denial test.

### 3. "Forgentic" es la marca pública; "Synterra" es el codename

- Surface usuario (`apps/web/**`, marketing, emails, UI copy) dice "Forgentic".
- "Synterra" sólo en npm scope (`@synterra/*`), `PLAN_*.md`, nombres de agente, commit messages internos.
- Test `apps/web/src/app/page.test.tsx` asserta zero `synterra` en HTML rendereado.
- `scripts/check-brand.sh` repo-wide grep gate en CI.

### 4. Workspaces = isolación; schemas = compartidos

Shared-schema + RLS (no schema-per-tenant, no database-per-tenant). Cada tabla tenant-scoped tiene `workspace_id uuid not null references workspaces(id) on delete cascade` + RLS policy.

### 5. Secrets nunca en código

- Cero hardcoded API keys, JWT secrets, DB URLs, Stripe tokens, Aquila API keys.
- Runtime config via `zod` desde `process.env` al boot. Missing/invalid → exit 1 con lista de keys.
- Prod secrets en Infisical (proyecto "Forgentic"). Dev en `.env.local` (gitignored).
- Logs + error payloads nunca incluyen auth headers, cookies, tokens, passwords, API keys. `pino.redact` paths globales.

### 6. Cada service tiene `/health`

- `apps/web`: `GET /api/health` → `{status:'ok', version, uptime}` con `Cache-Control: no-store`.
- `apps/api`: `GET /v1/health`.
- `apps/workers`: HTTP sidecar en `HEALTH_PORT` (default 3002) con `/health` + `/ready` (503 cuando redis no ready).

Health = liveness + version. Nunca DB roundtrip (readiness sí).

### 7. Graceful shutdown mandatorio

SIGTERM + SIGINT + uncaughtException + unhandledRejection → single `shutdown()` path con hard-kill `setTimeout(...).unref()` fallback. Nueva resource long-lived (queue, websocket, bg job) → register teardown en el mismo path.

### 8. Idioma primario = español

Copy UI por defecto ES-AR. EN como secundario (fallback chain). `lessons.md` en español. Código, commits, agent defs en inglés.

---

## Package naming + workspace layout

- Cada workspace = `@synterra/<kebab-case-name>`.
- Apps bajo `apps/<name>/` (`web`, `api`, `workers`).
- Shared bajo `packages/<name>/` — flat, un nivel. Si necesita sub-packages, probablemente no debe existir todavía.
- Cross-workspace imports via package name (`@synterra/shared`) — nunca relativos (`../../../shared`).

## Commit + PR workflow

- Conventional commits mandatory (enforced por `commitlint.config.cjs` en commit-msg + CI).
- 1 PR = 1 workstream item (`W0-1 §G`, `AQ-1`). Referenciar workstream en título o body.
- `../PLAN.md` + `../PLAN_SYNTERRA.md` actualizados en el mismo PR que cierra workstream.
- Screenshots para UI changes; entry en `tasks/lessons.md` para cualquier cosa sorpresa.

## Testing

- Unit tests colocated (Vitest). Packages usan su propio `vitest.config.ts`; root sólo `test.projects`.
- Integration con **Testcontainers** (Postgres real + Redis real). `ioredis-mock` + `bullmq` incompatible documentado.
- E2E Playwright (chromium + webkit + mobile-chromium) en `tests/e2e/`.
- Coverage floor: 80% statements / 70% branches / 80% functions / 80% lines. No silenciar threshold — add tests.

## Cuando te trabes

1. Re-leer sección de `../PLAN_SYNTERRA.md` referenciada por la task.
2. Re-leer invariantes de este archivo.
3. Mirar equivalente en Aquila (el data-plane resolvió mayoría de estos problemas).
4. Si seguís trabado: `docs/ADR/` con decision points + esperar architect sign-off.

**Nunca debilitar invariante silenciosamente** (RLS, workspace_id, no-Aquila-imports, brand purity, secret hygiene, graceful shutdown, health endpoints, español primario) para desbloquearte.
