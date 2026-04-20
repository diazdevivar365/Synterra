# PlanTracking — Synterra Implementation

> Una línea por tarea. Agentes: al **iniciar** una tarea → cambiar estado a `en curso`. Al **terminar** → cambiar a `hecha`. No arrancar una tarea sin actualizar este archivo primero.

| ID    | Título                                          | Estado       | Depende de          |
| ----- | ----------------------------------------------- | ------------ | ------------------- |
| W0-1  | Repo + tooling skeleton                         | hecha ✅     | —                   |
| W0-2  | Postgres setup + Drizzle scaffold               | hecha ✅     | W0-1                |
| W0-3  | Infrastructure (LXC + Docker + Cloudflare)      | hecha ✅     | W0-1                |
| W0-4  | Observability bootstrap (OTel + Prometheus)     | hecha ✅     | W0-3                |
| W1-1  | better-auth integration                         | hecha ✅     | W0-2                |
| W1-2  | Multi-workspace JWT + workspace UI              | hecha ✅     | W1-1                |
| W1-3  | WorkOS adapter (SSO/SAML/SCIM)                  | hecha ✅     | W1-1                |
| W2-1  | Workspace CRUD + memberships                    | hecha ✅     | W1-2 (impl en W1-2) |
| W2-2  | Aquila org provisioning (workspace-provisioner) | hecha ✅     | W1-2, AQ-1          |
| W2-3  | URL-first onboarding (90-second wow)            | hecha ✅     | W2-2                |
| W2-4  | Workspace switcher + multi-workspace UX         | hecha ✅     | W1-2 (impl en W1-2) |
| W3-1  | Plans + Stripe integration                      | hecha ✅     | W2-1                |
| W3-2  | Lago self-hosted deployment                     | hecha ✅     | W0-3                |
| W3-3  | Usage aggregator + quota enforcement            | hecha ✅     | W3-1, W3-2, AQ-3    |
| W4-1  | Brand dashboard + DNA viewer                    | hecha ✅    | W2-1                |
| W4-2  | Competitor monitoring + change feed             | hecha ✅     | W4-1                |
| W4-3  | Research run UI (live + history)                | pendiente ⏳ | W4-1, AQ-2          |
| W4-4  | AI generation surface                           | pendiente ⏳ | W4-1                |
| W5-1  | Notification engine                             | pendiente ⏳ | W3-1, W4-1          |
| W5-2  | Email templates (React Email + Resend)          | pendiente ⏳ | W1-1                |
| W5-3  | Weekly Brand Pulse digest                       | pendiente ⏳ | W5-1, W5-2          |
| W5-4  | Slack integration (Growth+)                     | pendiente ⏳ | W5-1                |
| W6-1  | Public API key issuance UI                      | pendiente ⏳ | W4-1                |
| W6-2  | Public API surface (v1 endpoints)               | pendiente ⏳ | W6-1                |
| W6-3  | Outbound webhooks (customer-facing)             | pendiente ⏳ | W6-2                |
| W6-4  | SDK generation pipeline                         | pendiente ⏳ | W6-2                |
| W6-5  | Public docs site                                | pendiente ⏳ | W6-2                |
| W7-1  | Admin app shell + auth (Cloudflare Access)      | pendiente ⏳ | W3-1                |
| W7-2  | Workspace explorer + impersonation              | pendiente ⏳ | W7-1                |
| W7-3  | Plan/billing operations (admin)                 | pendiente ⏳ | W7-1, W3-1          |
| W7-4  | Feature flags + ops dashboards                  | pendiente ⏳ | W7-1                |
| W8-1  | GDPR data export + delete                       | pendiente ⏳ | W3-1                |
| W8-2  | Audit log surface (Scale+)                      | pendiente ⏳ | W2-1                |
| W8-3  | Cookie consent + legal pages                    | pendiente ⏳ | W0-3                |
| W8-4  | SOC 2 prep (Vanta onboarding)                   | pendiente ⏳ | W8-3                |
| W8-5  | Penetration test                                | pendiente ⏳ | W8-4                |
| W9-1  | Marketing site (forgentic.io landing)           | pendiente ⏳ | W4-1                |
| W9-2  | Pricing + Stripe Checkout self-serve            | pendiente ⏳ | W3-1, W9-1          |
| W9-3  | Help center / changelog                         | pendiente ⏳ | W9-1                |
| W10-1 | Load test (k6, 1k concurrent users)             | pendiente ⏳ | W9-1                |
| W10-2 | Onboarding optimization (A/B test)              | pendiente ⏳ | W2-3, W9-1          |
| W10-3 | OmeletStudio customer migration                 | pendiente ⏳ | W2-1, W4-1          |
| W10-4 | Public launch                                   | pendiente ⏳ | W10-1, W10-2, W10-3 |

---

_Fuente de verdad para detalle de cada workstream: `tasks/todo.md`. Este archivo es el tracker rápido para agentes._
