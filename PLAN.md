# Synterra — Implementation Plan
## Multi-Tenant SaaS Workspace built on Aquila

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan workstream-by-workstream. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Synterra — a production-grade, multi-tenant SaaS workspace platform that productizes Aquila's brand-intelligence engine for paying B2B customers (SMB marketing teams, agencies, mid-market). Tier-1 quality from day 1: enterprise auth, real-time UX, hybrid billing, GDPR-ready, full observability per tenant.

**Architecture:** Synterra is a **new control plane** running as a separate Next.js 16 service in its own LXC container, with its own Postgres 16 database. It owns customer identity, workspace lifecycle, billing, and the user-facing UX. It calls Aquila (the **data plane**, unchanged) over HTTP using short-lived per-request JWTs minted with the existing `organizations` + `org_api_keys` primitives that Aquila already exposes (migration `0006_orgs.sql`). Aquila stays single-purpose.

**Tech Stack (Phase 1 — production AWS, target after Proxmox phase):** Next.js 16 (App Router, RSC, Server Actions) · TypeScript strict · Drizzle ORM v1 · **AWS RDS Postgres 16 Multi-AZ** · **AWS ElastiCache Redis Multi-AZ** · **AWS ECS Fargate** (web + workers) · **AWS ALB** · BullMQ · better-auth · WorkOS · Stripe Billing · Lago on ECS Fargate + RDS · Resend + React Email · Supabase Realtime · shadcn/ui + Tailwind · TanStack Query · Zustand · OpenTelemetry → **AWS Managed Prometheus + AWS Managed Grafana + CloudWatch** · Cloudflare (WAF + Turnstile + DDoS, kept in front of AWS) · Infisical for secrets (kept self-hosted; AWS Secrets Manager later TBD).

**Tech Stack (Phase 0 — Proxmox production-grade for friendly customers):** Same application code. Lean on managed-equivalent layers (single Postgres + single Redis instead of replicas/clusters) because AWS will replace those — but **production-grade where our code lives** (3 Next.js replicas + 2 BullMQ worker replicas + Traefik L7 LB + 14d observability + alerting + status page). See REVISION 2026-04-19 below.

---

## REVISION 2026-04-19 — Phase 0 (Proxmox production) → Phase 1 (AWS production)

### Strategic position

**Phase 0 is NOT "validation only".** Friendly customers will use Synterra on Proxmox during Phase 0. The product must be 100% production-grade in both environments — same code, same UX guarantees, same SLO commitments, same security posture, same data-protection guarantees. The migration to AWS is an **infra swap**, not a "promotion to production".

User's verbatim direction (2026-04-19): *"la solucion tiene que estar 100% funcional desde esta infrastrucutre LXC de la misma forma que estara en AWS"*.

### Design principle (the one that resolves all sizing decisions)

**Anything that runs Forgentic code = production-grade in both environments. Anything that is a managed service in AWS = lean in Proxmox only because AWS operates it for us.**

| Layer | Runs our code? | Phase 0 quality bar | Phase 1 (AWS) |
|---|---|---|---|
| Next.js (web) | ✅ | **Production-grade**: 3 replicas, Traefik LB, health checks, graceful drain 30s, rolling deploy 1-at-a-time | ECS Fargate auto-scaling 2-N tasks |
| BullMQ workers | ✅ | **Production-grade**: 2 replicas, supervisor restart, idempotent jobs, dead-letter | ECS Fargate auto-scaling 2-N tasks |
| Auth · RLS · Billing pipeline · Onboarding · Webhook delivery · Notification engine · Public API | ✅ (all in Next.js) | **Production-grade** — every contract works, every test green, every error path handled | Same code on ECS Fargate |
| Lago (3rd-party) | ❌ (not our code) | **Single instance OK** — back up Lago DB nightly | ECS Fargate (1 task at this scale) |
| Postgres | ❌ (managed in AWS) | **Single instance + production-grade backups** (continuous WAL archive to SAN + nightly base backup off-site B2) + monitoring + alertmanager. Manual restore runbook tested. | RDS Postgres Multi-AZ |
| Redis | ❌ (managed in AWS) | **Single instance + AOF every 1s + nightly RDB to SAN** + Sentinel-mode client config (env-only swap to AWS later) | ElastiCache Redis Multi-AZ |
| Load balancer (us ↔ world) | ❌ (managed in AWS) | **Traefik in front of 3 Next.js replicas** (full L7: health, drain, certs, /metrics) | ALB |
| Observability stack | ❌ (3rd-party tools, our config) | **Production-grade**: 14-day retention, Alertmanager → email/SMS, dashboards live, status page wired | AWS Managed Prometheus + Managed Grafana + CloudWatch |
| Cloudflare WAF + Tunnel + Turnstile | ❌ (vendor) | Same in both phases | Same |
| Secrets management (Infisical) | ❌ (3rd-party) | Same in both phases | Same (or AWS Secrets Manager — defer) |

### Hardware reality (Proxmox cluster, captured 2026-04-19)

**Node 1** — Dell Precision 3240 Compact: i7-10700 (16 cores), 16 GB DDR4-3200 (2× 8GB SODIMM, expandable to 64GB), 1× NVMe 512GB; LVM root **at 96% — 4 GB free, CRITICAL** ⚠️.

**Node 2** — Dell Precision 5680 (mobile workstation): i9-13900H (20 cores P+E hybrid), 32 GB LPDDR5x-6400 soldered, 1× NVMe 1TB (44% used, healthy), RTX 3500 Ada GPU (12 GB VRAM — future ML inference).

**Shared storage** — SAN 2 TB via iSCSI, mountable from both nodes (enables LXC live-migration + cross-node shared storage).

**Cluster** — 2 nodes today, 3rd similar to node 2 planned. 2-node cluster has weak quorum; fixed when 3rd node lands or by adding a Q-device (RaspberryPi running `corosync-qnetd`).

**Aggregate available** after Proxmox + existing Aquila LXC: ~36 vCPU, ~38 GB RAM, ~2 TB SAN + ~1.5 TB local NVMe.

### Pre-work (BEFORE any Phase 0 LXC creation) — Group P0-pre

**P0-pre1: Clean node 1 disk to <70% — URGENT, do this first**
- Identify space hogs: `du -sh /var/lib/{vz,lxc,docker} /var/log /var/tmp /root`.
- Common wins: `apt clean`, prune unused Docker images, delete old LXC backups in `/var/lib/vz/dump/`, remove obsolete LXC templates.
- Target: ≥25 GB free on node 1's root partition.
- Until done: do NOT provision new LXCs on node 1, do NOT install large packages, monitor `df -h` daily.

**P0-pre2: Mount SAN as Proxmox shared storage**
- Datacenter → Storage → Add → iSCSI → SAN portal IP.
- Add LVM (or LVM-thin for snapshots) on top of iSCSI target → enable "Shared".
- Storage ID `san2tb`, content type "Disk image, Container".
- Validate: both nodes see the same storage; create throwaway test LXC; live-migrate node 1 ↔ node 2; destroy.

**P0-pre3: Verify cluster quorum + plan 3rd node or Q-device**
- `pvecm status` confirms quorum.
- Decision: schedule 3rd node OR set up Q-device on a RaspberryPi (5W, ~$35) for quorum-without-compute. Recommend Q-device — cheap insurance until 3rd node arrives.

### Phase 0 — Proxmox Production Topology (5 LXCs)

All LXC root disks on `san2tb`. OS = Debian 12. Flags: unprivileged, `nesting=1`, `keyctl=1`. (Section M.1.1 below is **superseded for Phase 0** by this table; preserved as historical reference.)

| LXC | Role | Node | vCPU | RAM | Disk (SAN) | AWS Phase 1 equivalent |
|---|---|---|---|---|---|---|
| `forgentic-app.lan` | **Traefik LB** + **3 Next.js replicas** (web-1/2/3) + **2 BullMQ worker replicas** + cloudflared + promtail + grafana-agent | Node 2 | **4** | **6 GB** | **20 GB** | ECS Fargate (web + workers, both auto-scale 2-N) + ALB |
| `forgentic-db.lan` | Postgres 16 single + **continuous WAL archive to SAN + nightly base backup to Backblaze B2** + node-exporter | Node 2 | 2 | 4 GB | 30 GB | RDS Postgres 16 Multi-AZ (db.t4g.small → bigger as needed) |
| `forgentic-cache.lan` | Redis 7 single + AOF every 1s + nightly RDB to SAN + replication lag metric (wired for AWS swap) + node-exporter | Node 2 | 1 | 1.5 GB | 5 GB | ElastiCache Redis 7 Multi-AZ (cache.t4g.micro) |
| `metering.lan` | Lago + Lago Postgres + Lago Redis (one compose) + nightly Lago DB dump to SAN | Node 1 | 2 | 3 GB | 15 GB | ECS Fargate (Lago) + RDS Postgres for Lago |
| `observability.lan` | Prometheus + Loki + Tempo + Grafana + **Cachet (status page backend)** + Alertmanager → email/SMS · **14-day retention** · serves Aquila + Forgentic + future verticals | Node 1 | 2 | 4 GB | 25 GB | AWS Managed Prometheus + AWS Managed Grafana + CloudWatch |
| **TOTAL** | node 1: 4 vCPU / 7 GB / 40 GB · node 2: 7 vCPU / 11.5 GB / 55 GB | **11 vCPU** | **18.5 GB** | **95 GB on SAN** | |

**Capacity check vs available cluster:**
- Node 1: 4 / 16 vCPU = 25%, 7 / 16 GB = 44%. Disk pressure resolved by SAN.
- Node 2: 7 / 20 vCPU = 35%, 11.5 / 32 GB = 36%. Comfortable headroom.
- SAN: 95 GB / 2 TB = 5%. Room for years.

**Intentionally NOT in Phase 0** (skip-because-AWS):
- ❌ Postgres replica + Patroni → AWS RDS Multi-AZ replaces. Mitigation: continuous WAL archive + alert on primary down + tested manual-restore runbook (≤30min RTO).
- ❌ Redis Sentinel cluster → AWS ElastiCache Multi-AZ replaces. Mitigation: AOF every 1s + nightly RDB; client already in Sentinel mode (env-only swap).
- ❌ Multi-host LXC distribution for HA → single Proxmox host failure accepted risk during Phase 0 (RTO 1-4h via SAN snapshot restore to second node). Real HA arrives with AWS Multi-AZ.
- ❌ pgbackrest with cross-region replicas → B2 off-site sufficient for Phase 0 friendly-customer scale.

**IS production-grade in Phase 0** (because it's our code or directly customer-affecting):
- ✅ 3 Next.js replicas behind Traefik with health checks + 30s graceful drain + 1-at-a-time rolling restart on every deploy.
- ✅ 2 BullMQ worker replicas with supervisor restart + idempotent jobs + dead-letter queue.
- ✅ Continuous DB WAL archive (PITR ≤1s precision in last 30 days).
- ✅ Alertmanager wired to real email/SMS channels.
- ✅ `status.forgentic.io` live (Cachet) — customers see system health.
- ✅ Data export + delete endpoints actually work + tested.
- ✅ RLS test suite green on every CI run (>200 cross-tenant test cases).
- ✅ Webhook delivery: HMAC sig + 8-retry exponential backoff + dead-letter dashboard.
- ✅ Audit log functional + queryable.
- ✅ Light security review (internal, external if budget allows) pass before first friendly customer.

### Phase 0 application principles (PRESERVED — these matter for portability)

1. **All DB access via env-var connection strings.** `DATABASE_URL_PRIMARY` and `DATABASE_URL_REPLICA` always exist; in Phase 0 both point to the same single Postgres; in Phase 1 they point to RDS writer + reader. Code never knows.
2. **All Redis access via Sentinel-aware client.** Even with 1 Redis node, configure BullMQ + better-auth in Sentinel mode pointing at a single "fake sentinel" (the master itself). Phase 1 swap = env only.
3. **RLS + workspace context middleware identical** to production target. If RLS works in Phase 0, it works in Phase 1.
4. **Cross-service calls over HTTPS with auth headers** — never over Tailscale/internal trust. Phase 0 = HTTPS over LAN; Phase 1 = HTTPS over VPC. Same code.
5. **Idempotency keys, audit logs, OTel spans** built day 1 in Phase 0.
6. **No hardcoded hostnames** anywhere (already a hard rule from Aquila lessons). Every endpoint = env var.

### Phase 1 — AWS Migration Plan (target ~3-6 months after Phase 0 launches)

**When to migrate:** when application contracts validated, friendly customers happy, and we're ready to onboard at broader scale (or before public launch — see W10-4).

**Architecture target:**

```
              Cloudflare (WAF + Turnstile + DDoS, kept in front)
                              ↓
                    Route 53 → ALB (public)
                              ↓
                    ECS Fargate cluster (private subnets)
                       ├─ forgentic-web service (auto-scale 2-N)
                       ├─ forgentic-workers service (auto-scale 2-N)
                       └─ lago service (auto-scale 1-N)
                              ↓
            ┌─────────────────┼─────────────────┬──────────────────┐
            ▼                 ▼                 ▼                  ▼
       RDS Postgres     ElastiCache Redis   RDS Postgres        S3 buckets
       Multi-AZ         Multi-AZ            (Lago, Multi-AZ)    (uploads,
       (db.t4g.small)   (cache.t4g.micro)   (db.t4g.micro)       backups)
                              ↓
       AWS Managed Prometheus + Amazon Managed Grafana +
       CloudWatch Logs + AWS X-Ray (traces)
```

**Migration runbook (per Phase 0 LXC):**

| Phase 0 component | AWS target | Migration steps | Code changes |
|---|---|---|---|
| `forgentic-db.lan` | RDS Postgres Multi-AZ | 1. Create RDS in target VPC. 2. `pg_dump` from Phase 0. 3. `pg_restore` to RDS. 4. Validate row counts + RLS via test suite. 5. Cut over via env-var swap (5min maintenance window). | None (`DATABASE_URL_*` env change) |
| `forgentic-cache.lan` | ElastiCache Redis Multi-AZ | 1. Create ElastiCache cluster. 2. Empty Phase 0 cache (sessions reload, jobs drained). 3. Update `REDIS_SENTINEL_*` env. | None |
| `forgentic-app.lan` | ECS Fargate + ALB | 1. Build Docker image. 2. Push to ECR. 3. ECS task definition + service. 4. ALB + target group + health check. 5. Cloudflare CNAME → ALB DNS. | None (12-factor) |
| `metering.lan` | ECS Fargate (Lago) + RDS for Lago | 1. Deploy Lago to ECS. 2. RDS for Lago Postgres. 3. Migrate Lago data. 4. Update `LAGO_API_URL` env. | None |
| `observability.lan` | AMP + AMG + CloudWatch | 1. Provision Managed Prometheus workspace. 2. Provision Managed Grafana, import dashboards. 3. Reconfigure OTel collectors → AMP endpoint. | OTel exporter env change |

**Estimated AWS monthly cost at launch (~10-100 workspaces):**

| Service | Tier | $/mo |
|---|---|---|
| RDS Postgres db.t4g.small Multi-AZ | 2 vCPU, 2 GB | ~$60 |
| ElastiCache cache.t4g.micro Multi-AZ | 0.5 GB | ~$25 |
| ECS Fargate (3 tasks avg, 0.5 vCPU + 1 GB) | always-on | ~$50 |
| ALB | 1 LCU avg | ~$25 |
| RDS for Lago db.t4g.micro | 1 vCPU, 1 GB | ~$15 |
| AMP + AMG + CloudWatch Logs | low traffic | ~$30 |
| S3 + data transfer | minimal | ~$10 |
| Route 53 | 1 hosted zone | $0.50 |
| **Total at launch** | | **~$215/mo** |

Scales to **~$800-1500/mo at 1000 workspaces**. 1 paying Growth customer ($199/mo) covers infra cost.

**What stays self-hosted in Phase 1:** Aquila (until it migrates separately), Infisical (or move to AWS Secrets Manager later), Cloudflare in front (best-of-breed; not replacing with AWS WAF).

**What changes between Phase 0 and Phase 1 in the code:** essentially zero, IF Phase 0 was built with the discipline above. 12-factor app pattern absorbs the swap.

### Updated execution sequence

Insert into Section N's group sequence:

**Group P0-pre — Proxmox cluster prep (BEFORE W0-1):** clean node 1 disk · mount SAN as `san2tb` · verify quorum / Q-device.

**Group P1 — AWS migration (AFTER W10-3, BEFORE W10-4 public launch):** AWS account + VPC + Terraform · per-service modules · staging cutover then prod · DNS swap + 7-day observation · decommission Proxmox LXCs.

**W10-4 public launch happens AFTER P1-4** — marketing site goes live with the AWS-backed app.

---

## DECISIONS RESOLVED (2026-04-19, post-plan-approval — superseded items annotated)

The five open decisions from the original Section Q are now closed:

1. **Hosting model — DECIDED, then REVISED 2026-04-19:** Phase 0 = Proxmox **production-grade for friendly customers** (5 LXCs, lean only on managed-equivalent layers — see REVISION above). Phase 1 = AWS managed services for production scale. Original "all self-hosted, 9-LXC HA" deferred indefinitely.
2. **Pricing currency — DECIDED:** **USD as base.** ARS shown as conversion (daily rate fetched from a public FX API at request time, since ARS fluctuates with inflation+USD daily). Conversion is presentation-only; Stripe always charges in USD. Fallback to USD-only display if FX API fails.
3. **Brand & domain — DECIDED:** Public-facing brand is **Forgentic** at **`forgentic.io`** (already owned at Namecheap; delegating NS to Cloudflare — see "DNS Strategy" below). **"Synterra" is the internal codename only** — never exposed to customers. See "Naming Strategy" below.
4. **Trial CC requirement — DECIDED:** **No credit card required at trial.** Implemented as a single feature flag `TRIAL_REQUIRES_CC=false` in Infisical so it can flip in 5 minutes without code changes. Stripe Subscription is still created at trial start (in `trialing` status with no payment method), so flipping the flag later just enforces presence-of-PM at signup.
5. **Aquila usage endpoint (AQ-3) — DECIDED:** Build AQ-3 in Aquila *and* push billing/metering into a **dedicated `metering.lan` LXC** (Lago + its DB + its Redis), and observability into a **dedicated `observability.lan` LXC** (Prometheus + Loki + Grafana + Tempo). Reason: as more "vertical Aquilas" land (image gen, voice, etc.), they all need to plug into one billing+observability surface — building it as a separate LXC from day 1 makes that trivial.

---

## Naming Strategy — Synterra (internal) vs Forgentic (public)

| Where | Name | Examples |
|---|---|---|
| **Customer-facing surfaces** | **Forgentic** | landing `forgentic.io`, app `app.forgentic.io`, API `api.forgentic.io`, docs `docs.forgentic.io`, admin `admin.forgentic.io`, status `status.forgentic.io`, marketing copy, transactional emails, support comms, legal docs, invoices, OG tags, page titles, OpenAPI title |
| **Internal codename** | Synterra | repo dir `Synterra/`, package names `@synterra/*`, subagent names `synterra-*`, Postgres database name `synterra`, internal LXC label allowed (we use `forgentic-app.lan` etc. since DNS is internal anyway), commit messages, internal docs, error log prefixes |

**Rule (vendor names):** **never** use a third-party vendor name as a hostname, container name, env var prefix, or directory name. Always use the **role** the thing plays. Examples:

| ❌ Vendor-coupled | ✅ Role-based | Why |
|---|---|---|
| `infisical.internal` | `secrets.internal` | If we swap Infisical for Vault, OpenBao, 1Password Connect, or Doppler, the hostname stays correct |
| `lago-dashboard.internal` | `meter.internal` | Lago could be replaced by Orb, Metronome, custom |
| `grafana.internal` | `metrics.internal` | Grafana could be swapped for Perses or custom |
| `LAGO_API_KEY` | `METERING_API_KEY` | Provider-agnostic env var, vendor switch = config change only |
| `RESEND_API_KEY` | `EMAIL_API_KEY` | Same logic; can switch to Postmark/SES without code changes |

**Exception:** *inside a vendor's own Docker container or its config file*, vendor terminology is fine (`lago-postgres` as a container name within `metering.lan` LXC's compose is OK because it's literally configuring Lago). The boundary is: anything our team types in a runbook, anything that surfaces in DNS, any env var our code reads — **role-based**.

This same principle from `Aquila/tasks/lessons.md` ("cero hardcoding de providers / model names") extends to identifiers, not just values.

**Rule (codename leak):** any string that could leak to a customer (HTTP responses, error messages, email From: line, OG tags, page titles, JS bundle filenames visible in DevTools, OpenAPI title, status page) **MUST** say "Forgentic". Internal code identifiers can say "Synterra". A CI grep gate enforces this:

```bash
# CI fails if any user-facing source file contains "Synterra"
# (catches accidentally leaked codename branding)
if grep -rn -i "synterra" \
     apps/web/app apps/web/components apps/api/src \
     packages/emails packages/ui \
     2>/dev/null; then
  echo "ERROR: 'Synterra' codename leaked into customer-facing code"
  exit 1
fi
```

**Public domain map:**

| Hostname | Purpose | Origin |
|---|---|---|
| `forgentic.io` | Marketing landing (Next.js, public routes) | `forgentic-app.lan` via Traefik |
| `app.forgentic.io` | Authenticated workspace UI | `forgentic-app.lan` via Traefik |
| `api.forgentic.io` | Public REST API + webhooks endpoint | `forgentic-app.lan` via Traefik |
| `docs.forgentic.io` | Mintlify/Nextra docs | `forgentic-app.lan` (or static via Cloudflare Pages) |
| `admin.forgentic.io` | Internal admin (Cloudflare Access protected, Google Workspace SSO + IP allowlist) | `forgentic-app.lan` via Traefik |
| `status.forgentic.io` | Status page (Cachet self-hosted or Atlassian Statuspage) | `observability.lan` |

**Internal-only hostnames** (LAN, never reachable from public internet):

| Hostname | Purpose |
|---|---|
| `meter.forgentic.internal` | Lago dashboard (only via Tailscale/VPN) |
| `metrics.forgentic.internal` | Grafana (only via Tailscale/VPN) |
| `traces.forgentic.internal` | Tempo UI (only via Tailscale/VPN) |
| `secrets.forgentic.internal` | Secrets manager UI (currently backed by Infisical, reused from Aquila — hostname is vendor-agnostic so we can swap providers without renaming) |

---

## DNS Strategy — Namecheap registrar, Cloudflare authoritative

**Decision:** Keep the registrar at **Namecheap** (you own renewal + billing). **Delegate nameservers to Cloudflare** (free plan) so Cloudflare becomes DNS authoritative. This is required for Cloudflare Tunnel, WAF, Turnstile, Bot Management, and edge rate-limiting to work.

**Why mandatory (not nice-to-have):**
- Cloudflare Tunnel auto-provisions DNS records pointing the public hostnames to the Tunnel — only works if CF is authoritative.
- WAF rules execute at CF's edge before traffic reaches origin — needs CF to receive the request.
- Turnstile (signup spam protection) is bundled with CF and signed by them.
- Argo Smart Routing (faster origin pull) requires CF as authoritative.

**You do NOT transfer the registrar.** Domain ownership stays with Namecheap. Renewal still bills there.

**Migration runbook (one-time, ~10 min click-ops + 2-24h global propagation):**

1. **Cloudflare side:**
   - Sign in to dash.cloudflare.com → "Add a Site" → enter `forgentic.io` → choose **Free** plan.
   - CF auto-scans existing DNS records from Namecheap. **Verify every record is captured** before continuing — especially MX (mail), TXT (SPF/DKIM/DMARC + any 3rd-party verification records like Google site verification), CAA (cert authority authorization), and any pre-existing CNAMEs.
   - Note the 2 nameservers CF assigns (form `xxx.ns.cloudflare.com` + `yyy.ns.cloudflare.com`).

2. **Namecheap side:**
   - Domain List → Manage `forgentic.io` → Nameservers → switch from "Namecheap BasicDNS" to **"Custom DNS"** → paste the 2 CF nameservers → Save.

3. **Wait** 2–24h for global propagation. Verify with `dig NS forgentic.io +short` — when it returns the CF nameservers, propagation is complete.

4. **Cloudflare side, post-propagation (security baseline):**
   - **SSL/TLS mode:** Full (strict) — origin uses CF Tunnel, no exposed IP, full E2E encryption.
   - **Always Use HTTPS:** ON.
   - **HSTS:** ON with `max-age=31536000` + preload (after verifying nothing breaks for 7 days).
   - **Min TLS Version:** 1.2.
   - **Bot Fight Mode:** ON.
   - **Email Routing** (optional): if you want `*@forgentic.io` to forward, configure here; otherwise keep MX pointing wherever you host mail today.
   - **Cloudflare Tunnel:** install `cloudflared` daemon on the `forgentic-app.lan` LXC, authenticate via Tunnel token (stored in Infisical), create routes for the 5 public hostnames pointing to local Traefik (`https://traefik.synterra.local:443`).

5. **Cloudflare WAF rules** (added during W0-3):
   - Rate-limit `/api/auth/*` to 10 req/min/IP.
   - Rate-limit `/api/webhooks/stripe` to 100 req/min/IP (verify Stripe IP ranges allowlisted).
   - Block POST to `/start` without a valid Turnstile token.
   - Cache `/docs/*` aggressively (1h browser TTL, 24h CF edge TTL).
   - Geo-block sanctioned regions per US OFAC list (legal requirement; configurable later).

**Reversibility:** changing nameservers back to Namecheap takes 5 min in their UI + propagation. Worst case = 24h "use the dev URL via direct IP" while DNS catches up. No data loss.

---

## Context — Why This Plan Exists

The user has spent ~6 months building Aquila — a distributed brand-intelligence orchestrator with unique capabilities (Neo4j knowledge graph per tenant, hybrid Qdrant search, multi-provider LLM routing, Mullvad-routed scraping, change detection across 1000s of websites). Aquila is currently consumed by exactly one customer: **OmeletStudio** (the user's other project), via a server-to-server API.

The strategic decision (captured in memory `project_strategic_direction.md`, 2026-04-19): productize Aquila as a multi-tenant SaaS, branded **Synterra**, where end customers self-serve. The user is explicit:

1. **Think big** — compete with Jasper/Notion/Linear-tier products. No "ship now, fix later". No "small team can't do that".
2. **Leverage flexibility** — small team + no investor timeline = no shortcut excuses, but also no enterprise bureaucracy. Use this as an asymmetric advantage.
3. **Aquila has unique tools** — the SaaS layer must surface those (workspace-scoped brand DNA, competitor change feeds, on-demand research) as the *core differentiator*, not as add-ons.

Aquila is **not finished** (open items in `Aquila/tasks/todo.md`: H5 token rotation, D1-D4 maintainability, Phase 8 frontend unify, services re-audit). Synterra design must assume Aquila keeps evolving and never lock Synterra into Aquila's current shape — talk to Aquila over **versioned HTTP contracts only**.

Aquila already has 75% of the multi-tenant primitives Synterra needs:

| Aquila already provides (data plane) | Synterra owns (control plane) |
|---|---|
| `organizations` table (slug, plan, settings, is_active) | User accounts, multi-workspace memberships, sessions |
| `org_api_keys` (hashed, scoped, expirable) | Stripe customer → workspace mapping, plan enforcement |
| JWT with `org_id` claim + `require_user/require_org/require_admin` deps | better-auth + WorkOS, multi-workspace JWT issuance |
| `users.org_id` FK to organizations | Onboarding wizard, workspace switcher UX |
| Per-org webhooks (HMAC-signed, dispatchable) | Webhook subscription UI, public webhook portal |
| 11 Arq workers all `org_id`-scoped | Workspace-scoped quota enforcement before enqueue |
| Per-org settings JSONB | Workspace branding, integrations UI |
| Change-event detection per brand | Notifications engine, weekly digests, alert preferences |

**This plan never modifies Aquila core code without an explicit "Aquila change" task.** Where Aquila gaps block Synterra (e.g., no `workspace_members` table, no usage event ledger, no scoped service-token issuance endpoint), the plan calls out an explicit **Aquila Change** workstream — those go through the existing `aquila-*` subagents and Aquila's own `tasks/todo.md` flow, *not* Synterra's repo.

---

## Strategic Positioning

**Tagline (working):** *The brand-intelligence workspace your team operates from.*

**Positioning vs market:**

| Competitor | Their strength | Synterra's edge |
|---|---|---|
| **Jasper / Copy.ai** | AI writing | We have *brand context* (DNA, voice, competitors, change feed) — their AI writes generic, ours writes *for your brand* |
| **Crayon / Klue** | Competitive intel for enterprise | We bundle competitive intel + creative generation + always-on monitoring at SMB price |
| **Notion AI** | General workspace + AI | We're vertical (marketing/brand teams) with deep tools, not a general doc tool |
| **HubSpot / Semrush** | Marketing platforms | We don't do CRM/SEO; we own the *brand intelligence* layer they all need to plug into |
| **Linear / Asana** | Workflow | We're not a tracker; we're the source of truth for *what's true about your brand and your competitors right now* |

**ICP (Ideal Customer Profile) for v1 launch:**
- **Primary:** SMB marketing teams (5-50 marketers) at brands with strong identity needs (DTC, fashion, food, premium services).
- **Secondary:** Boutique creative agencies running 5-30 client workspaces (multi-client model — one Synterra account, many client workspaces).
- **Future enterprise:** mid-market (200-2000 employees) needing SSO/SCIM/audit — design enables it; sales enables it.

**The five non-negotiables that define "tier-1":**
1. **Time-to-wow ≤ 90 seconds** — paste a URL, see your brand DNA + top 3 competitors, before signup completes. This is the demo and the onboarding.
2. **Workspace data isolation provable in court** — RLS enforced in Postgres, verified per-request, audited on every release.
3. **Real-time everywhere it matters** — workspace member presence, change-feed updates, run progress streaming. No "refresh to see updates".
4. **Sub-second perceived latency** — optimistic UI, edge caching, RSC streaming. Workspace pages feel native, not webby.
5. **Single workspace switcher pattern that scales to 50 workspaces** (agency users) — Linear/Slack-class UX.

---

## Section A — North-Star Architecture

### A.1 Component topology (9-LXC, see Section M for detail)

```
                ┌──────────────────────────────────────────────────────┐
                │  CLOUDFLARE EDGE                                     │
                │  WAF · Turnstile · Bot Fight · Rate-limit · Cache    │
                │  Tunnel terminates here, encrypted to origin         │
                └──────────────────────┬───────────────────────────────┘
                                       │ Cloudflare Tunnel
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  LXC 2: forgentic-app.lan       (Forgentic / Synterra control plane)  │
   │  ┌──────────┐                                                          │
   │  │ Traefik  │  L7 LB · health checks · drain · TLS terminate           │
   │  └─┬────┬─┬─┘                                                          │
   │    │    │ │                                                            │
   │  ┌─▼─┐┌─▼─┐┌─▼─┐  Next.js 16 (App Router, RSC, Server Actions)        │
   │  │w-1││w-2││w-3│  3 replicas, rolling deploys                          │
   │  └─┬─┘└─┬─┘└─┬─┘                                                       │
   │    └────┼────┴───→ PgBouncer (writes→primary, reads→replica)           │
   │         │           Sentinel client (Redis HA)                          │
   │         │           AquilaClient (60s JWT per call)                     │
   │  ┌──────┴──────┐                                                        │
   │  │ BullMQ      │  workers: stripe-webhooks · email · usage-aggregator   │
   │  │ workers ×3  │           notification-dispatcher · workspace-prov.    │
   │  └─────────────┘                                                        │
   │  cloudflared (Tunnel) · promtail · grafana-agent                        │
   └─────┬───────────┬─────────────┬─────────────┬───────────────┬──────────┘
         │           │             │             │               │
         │ pg-write  │ pg-read     │ Sentinel    │ Lago events   │ AQ-1/2/3
         ▼           ▼             ▼             ▼               ▼
   ┌──────────┐┌──────────┐  ┌────────────┐ ┌────────────┐ ┌──────────────┐
   │ LXC 3    ││ LXC 4    │  │ LXC 5/6/7  │ │ LXC 8      │ │ LXC 1        │
   │ db-      ││ db-      │  │ cache-1/2/3│ │ metering   │ │ aquila.lan   │
   │ primary  ││ replica  │  │ Redis      │ │ Lago + DB  │ │ (existing)   │
   │ Postgres ││ Postgres │  │ + Sentinel │ │ + Redis    │ │ FastAPI · 11 │
   │ master   ││ standby  │  │ 3-node HA  │ │ isolated   │ │ Arq workers  │
   │ + WAL    ││ + nightly│  │ master+2   │ │            │ │ + Postgres   │
   │ archive  ││ pg_dump  │  │ replica    │ │ Source of  │ │ + Neo4j +    │
   │ → B2     ││ → B2     │  │            │ │ truth for  │ │ Qdrant       │
   │          ││          │  │            │ │ invoicing  │ │              │
   └────┬─────┘└──────────┘  └────────────┘ └─────┬──────┘ └──────┬───────┘
        │ streaming repl                          │               │
        │ (sync critical /                        │ (Lago triggers│
        │  async else)                            │  Stripe       │
        ▼                                         ▼  invoices)    │
                                          ┌─────────────────┐     │
                                          │ Stripe (payment)│     │
                                          └─────────────────┘     │
                                                                  │
   ┌──────────────────────────────────────────────────────────────┘
   │ all telemetry ships to ▼
   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ LXC 9: observability.lan                                              │
   │ Prometheus + Alertmanager · Loki · Tempo · Grafana · Cachet (status)  │
   │ Receives metrics/logs/traces from: Aquila + Forgentic + future        │
   │ "vertical Aquilas". Reachable only via Tailscale.                     │
   └──────────────────────────────────────────────────────────────────────┘
```

**Reading the diagram:**
- LXC numbers correspond to the inventory table in M.1.
- Solid arrows = data flow between LXCs (HTTPS over LAN, Tailscale-secured in v1.5).
- LXC 1 (`aquila.lan`) is the existing Aquila stack — only the AQ-1/2/3/4 endpoints from Section E.2 are net-new.
- Any future vertical AI service (image-gen, voice, social-publish, etc.) joins as a sibling LXC, registers with `forgentic-app` as a Capability Provider, and ships telemetry/usage events to LXCs 8 and 9.

### A.2 Trust boundaries (security)

```
PUBLIC INTERNET
    │
    ▼
┌─ Trust Zone: Edge (Cloudflare) ───────────────────────┐
│  WAF, DDoS, bot, rate-limit per IP                    │
└────────────────────────┬──────────────────────────────┘
                         │ TLS terminates at CF;
                         │ origin pull over Cloudflare Tunnel
                         ▼
┌─ Trust Zone: Synterra Public Surface ─────────────────┐
│  Next.js routes; better-auth sessions                 │
│  Rate-limit per workspace/user/IP                     │
│  Idempotency-Key on all writes                        │
└────────────────────────┬──────────────────────────────┘
                         │ Server Actions / RSC
                         │ Always with Drizzle + RLS
                         ▼
┌─ Trust Zone: Synterra Backplane ──────────────────────┐
│  Postgres (RLS), Redis, BullMQ workers                │
│  Tenant context: SET LOCAL synterra.workspace_id      │
│  No external traffic without explicit allowlist       │
└────────────────────────┬──────────────────────────────┘
                         │ HTTPS, short-lived JWT
                         │ org_id claim from current workspace
                         ▼
┌─ Trust Zone: Aquila Data Plane ───────────────────────┐
│  FastAPI; require_user/require_org JWT validation     │
│  Per-org rate limits, proxy_policy outbound           │
│  Org-scoped data access enforced at app layer         │
└───────────────────────────────────────────────────────┘
```

**Key invariants (Section A):**
1. **No traffic enters Synterra-internal services without going through the Next.js public surface.** No public Postgres, no public BullMQ admin.
2. **Synterra never holds Aquila's static `AQUILA_INTERNAL_TOKEN`.** Synterra holds *workspace-specific Aquila API keys* (one per workspace) and exchanges them for short-lived JWTs at request time.
3. **Every Synterra Postgres connection sets `SET LOCAL synterra.workspace_id`** before the first query. RLS denies otherwise.
4. **Every outbound request from Synterra to Aquila carries the workspace's JWT** (not a master key). If a Synterra bug tries to call Aquila with the wrong workspace's JWT, Aquila's `require_org` rejects it.

### A.3 Repository structure

Synterra lives in `/home/diazdevivar/Projects/Forgentic/Synterra/` (a sibling of `Aquila/`), not inside Aquila. It is a separate Git repo.

```
Synterra/
├── apps/
│   ├── web/              # Next.js 16 — main customer-facing app
│   ├── api/              # Public API (Next.js Route Handlers + Hono on /v1/*)
│   └── workers/          # BullMQ worker process (separate Node entry)
├── packages/
│   ├── db/               # Drizzle schema + migrations + RLS policies
│   ├── auth/             # better-auth config, WorkOS adapter
│   ├── billing/          # Stripe + Lago glue
│   ├── aquila-client/    # Typed HTTP client for Aquila API
│   ├── ui/               # shadcn/ui re-exports + Synterra components
│   ├── emails/           # React Email templates
│   ├── telemetry/        # OpenTelemetry init + tenant context propagation
│   └── shared/           # Cross-package types, zod schemas
├── infra/
│   ├── docker-compose.yml
│   ├── deploy-synterra.sh    # Modeled on Aquila/Backend/infra/deploy-aquila.sh
│   ├── cloudflare/           # CF Worker rules, WAF expressions
│   ├── grafana-dashboards/
│   └── migrations/           # Lago schema, Synterra DB init
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md                # Public API reference
│   ├── ONBOARDING.md
│   ├── BILLING.md
│   ├── SECURITY.md
│   └── RUNBOOKS/
├── .claude/
│   ├── agents/               # Synterra-specific subagents (see Section O)
│   └── settings.json
├── tasks/
│   ├── todo.md
│   └── lessons.md
├── tests/
│   ├── e2e/                  # Playwright E2E
│   ├── integration/          # Testcontainers (Postgres, Redis, Aquila stub)
│   └── unit/
├── package.json              # pnpm workspaces
├── turbo.json                # Turborepo for task orchestration
└── PLAN.md                   # this plan, copied here after approval
```

**Why pnpm + Turborepo:** monorepo enables typed contracts between `apps/web`, `apps/api`, and `apps/workers` without publishing internal packages. Turborepo gives task-graph caching for CI speed.

---

## Section B — Tenancy & Data Model

### B.1 Tenancy strategy

**Decision:** **Shared schema + Postgres Row-Level Security (RLS), in a brand-new `synterra` Postgres 16 database** — *separate* from Aquila's `aquila` database. Both DBs run on the same Postgres instance (or two instances if scale demands later) but have no FKs between them. The contract is the `workspace.aquila_org_slug` value, which Synterra writes into Aquila's `organizations.slug`.

**Why separate databases:**
- **Blast radius:** a Synterra schema migration cannot break Aquila's data plane.
- **Backup independence:** Aquila keeps its existing PITR + nightly dump cadence; Synterra adds its own.
- **Permissioning:** the `synterra` DB role has no read access to `aquila` tables. If the Synterra app is compromised, Aquila customer data is not directly exposed (defense in depth).
- **Future portability:** if Synterra needs to move to managed Postgres (Neon, Supabase) for scaling and Aquila stays self-hosted, the separation pre-enables that.

**Why shared schema + RLS (vs schema-per-tenant or DB-per-tenant):**
- Scales cleanly to **10K-100K workspaces** (the realistic SMB SaaS curve for years 1-3).
- RLS in Postgres 16+ is mature, planner cost issues are well-understood, fixes are documented.
- Migration story to dedicated DB for enterprise customers is straightforward (export workspace as SQL by `workspace_id`, restore into dedicated DB, switch routing).
- Single connection pool, single migration path, single ops surface.

**Hybrid escape hatch (planned, not built v1):** the `workspaces` table has a `db_routing_key` column (default `'shared'`). A future `workspace-router` package consults this on connection acquisition. Enterprise customers who buy "Dedicated Tenancy" addon get `db_routing_key = 'dedicated_<id>'` and a separate Postgres. Code path exists from day 1 (always-shared returns); switch flips the routing.

### B.2 Synterra Postgres schema (core entities)

All migrations in `packages/db/migrations/` using `drizzle-kit`. Every table is RLS-enabled.

#### Core identity

```sql
-- 0001_users.sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    email_verified  TIMESTAMPTZ,
    name            TEXT,
    avatar_url      TEXT,
    locale          TEXT DEFAULT 'en',
    last_login_at   TIMESTAMPTZ,
    is_suspended    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- users is NOT row-restricted — a user can always read their own record;
-- visibility of other users is gated by workspace_members membership.
```

#### Workspaces (= tenants)

```sql
-- 0002_workspaces.sql
CREATE TABLE workspaces (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug               VARCHAR(80) UNIQUE NOT NULL,  -- URL slug, also = aquila_org_slug
    name               TEXT NOT NULL,
    aquila_org_slug    VARCHAR(80) UNIQUE NOT NULL,  -- FK contract with Aquila.organizations.slug
    plan_id            VARCHAR(40) NOT NULL DEFAULT 'trial',  -- references plans table
    plan_status        VARCHAR(40) NOT NULL DEFAULT 'trialing',
    trial_ends_at      TIMESTAMPTZ,
    db_routing_key     VARCHAR(80) NOT NULL DEFAULT 'shared',
    settings           JSONB NOT NULL DEFAULT '{}'::jsonb,
    branding           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- logo, colors, custom domain
    bootstrap_url      TEXT,         -- the company URL given at signup
    bootstrap_state    VARCHAR(40) NOT NULL DEFAULT 'pending', -- pending|running|ready|failed
    suspended_at       TIMESTAMPTZ,
    suspension_reason  TEXT,
    deleted_at         TIMESTAMPTZ,  -- soft delete; hard purge after retention window
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_workspaces_plan        ON workspaces(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_workspaces_active      ON workspaces(id) WHERE deleted_at IS NULL AND suspended_at IS NULL;

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspaces_member_read ON workspaces FOR SELECT
  USING (id = current_setting('synterra.workspace_id', true)::UUID
         OR EXISTS (SELECT 1 FROM workspace_members
                     WHERE workspace_id = workspaces.id
                       AND user_id = current_setting('synterra.user_id', true)::UUID));
CREATE POLICY workspaces_owner_write ON workspaces FOR UPDATE
  USING (id = current_setting('synterra.workspace_id', true)::UUID
         AND EXISTS (SELECT 1 FROM workspace_members
                      WHERE workspace_id = workspaces.id
                        AND user_id = current_setting('synterra.user_id', true)::UUID
                        AND role IN ('owner', 'admin')));
```

#### Memberships (M:N users ↔ workspaces — the **single biggest improvement over Aquila's flat `users.org_id`**)

```sql
-- 0003_memberships.sql
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'manager', 'editor', 'viewer', 'guest');

CREATE TABLE workspace_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            workspace_role NOT NULL DEFAULT 'editor',
    invited_by      UUID REFERENCES users(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ,
    is_disabled     BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (workspace_id, user_id)
);
CREATE INDEX ix_members_user ON workspace_members(user_id) WHERE NOT is_disabled;
CREATE INDEX ix_members_ws   ON workspace_members(workspace_id) WHERE NOT is_disabled;

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_self_view ON workspace_members FOR SELECT
  USING (user_id = current_setting('synterra.user_id', true)::UUID
         OR workspace_id = current_setting('synterra.workspace_id', true)::UUID);
CREATE POLICY members_admin_write ON workspace_members FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID
         AND EXISTS (SELECT 1 FROM workspace_members m
                      WHERE m.workspace_id = workspace_members.workspace_id
                        AND m.user_id = current_setting('synterra.user_id', true)::UUID
                        AND m.role IN ('owner', 'admin')));
```

#### Invitations

```sql
-- 0004_invites.sql
CREATE TABLE invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email           CITEXT NOT NULL,
    role            workspace_role NOT NULL DEFAULT 'editor',
    invited_by      UUID NOT NULL REFERENCES users(id),
    token_hash      TEXT NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, email) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY invites_workspace_visible ON invites FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Aquila bridge (per-workspace credentials Synterra holds for Aquila)

```sql
-- 0005_aquila_credentials.sql
-- One row per workspace. Plaintext API key NEVER stored — only the Aquila-issued
-- prefix + the encrypted secret (envelope-encrypted with KMS key from Infisical).
CREATE TABLE aquila_credentials (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_id          UUID NOT NULL,        -- Aquila's org_api_keys.id
    api_key_prefix      VARCHAR(16) NOT NULL,
    api_key_secret_enc  BYTEA NOT NULL,       -- envelope-encrypted secret
    scopes              TEXT[] NOT NULL DEFAULT '{*}',
    last_rotated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE aquila_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY aquila_creds_workspace ON aquila_credentials FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Billing

```sql
-- 0006_billing.sql
CREATE TABLE plans (
    id                   VARCHAR(40) PRIMARY KEY,   -- 'starter', 'growth', 'scale', 'enterprise'
    name                 TEXT NOT NULL,
    description          TEXT,
    stripe_product_id    TEXT NOT NULL,
    stripe_price_id_seat TEXT,        -- per-seat price
    stripe_price_id_meter JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {ai_tokens: price_id, ...}
    seat_included        INT NOT NULL DEFAULT 1,
    quotas               JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {monthly_credits, max_competitors, max_brands, max_scrapes_per_day}
    features             JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ['sso', 'audit_log', 'priority_queue']
    is_visible           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id       TEXT NOT NULL,
    stripe_subscription_id   TEXT NOT NULL UNIQUE,
    plan_id                  VARCHAR(40) NOT NULL REFERENCES plans(id),
    status                   VARCHAR(40) NOT NULL,        -- trialing|active|past_due|canceled|paused
    current_period_start     TIMESTAMPTZ NOT NULL,
    current_period_end       TIMESTAMPTZ NOT NULL,
    cancel_at                TIMESTAMPTZ,
    canceled_at              TIMESTAMPTZ,
    seat_count               INT NOT NULL DEFAULT 1,
    metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_workspace ON subscriptions FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Usage events (the metering ledger)

```sql
-- 0007_usage.sql
-- Append-only ledger. Every metered action writes ONE row.
-- Lago ingests via batch every 60s for billing aggregation.
CREATE TABLE usage_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    user_id         UUID REFERENCES users(id),       -- nullable: scheduled jobs have no user
    event_type      VARCHAR(80) NOT NULL,            -- 'ai_generation' | 'competitor_scan' | 'export_pdf' | ...
    resource_id     TEXT,                            -- e.g. brand_id, run_id
    quantity        INT NOT NULL DEFAULT 1,
    cost_credits    INT NOT NULL,                    -- materialized from rate card at write time
    cost_usd_micros BIGINT,                          -- our cost (LLM tokens, scrape, etc.); for margin tracking
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT UNIQUE,                     -- supplied by emitter to dedupe
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions, auto-created by pg_partman
CREATE INDEX ix_usage_ws_time ON usage_events(workspace_id, created_at DESC);
CREATE INDEX ix_usage_type    ON usage_events(workspace_id, event_type, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_workspace ON usage_events FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
-- INSERT happens from server-side service-role connection (RLS bypassed via SECURITY DEFINER fn)
```

#### Quota / credit ledger (denormalized rollup for fast quota checks)

```sql
-- 0008_quota_ledger.sql
CREATE TABLE workspace_quotas (
    workspace_id        UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    credits_granted     INT NOT NULL,                  -- from plan + topups
    credits_consumed    INT NOT NULL DEFAULT 0,        -- updated by aggregator job
    soft_limit_reached  BOOLEAN NOT NULL DEFAULT FALSE,
    hard_limit_reached  BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workspace_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotas_workspace ON workspace_quotas FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Audit log (compliance-grade)

```sql
-- 0009_audit.sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL,
    actor_user_id   UUID,            -- nullable for system actions
    actor_kind      VARCHAR(20) NOT NULL,   -- 'user' | 'system' | 'api_key' | 'admin_impersonation'
    action          VARCHAR(80) NOT NULL,   -- 'workspace.created', 'member.role_changed', ...
    resource_type   VARCHAR(40),
    resource_id     TEXT,
    before          JSONB,
    after           JSONB,
    ip              INET,
    user_agent      TEXT,
    request_id      TEXT,            -- traceable to OTel span
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
CREATE INDEX ix_audit_ws_time ON audit_log(workspace_id, created_at DESC);
CREATE INDEX ix_audit_actor   ON audit_log(actor_user_id, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_workspace ON audit_log FOR SELECT
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
-- Admin impersonation actions visible to admins only (filter in app layer)
```

#### Notifications

```sql
-- 0010_notifications.sql
CREATE TABLE notification_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel             VARCHAR(20) NOT NULL,   -- 'email' | 'in_app' | 'webhook' | 'slack'
    event_type          VARCHAR(80) NOT NULL,
    config              JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (workspace_id, user_id, channel, event_type)
);
CREATE TABLE notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL,
    user_id         UUID,
    event_type      VARCHAR(80) NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL,   -- 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
    payload         JSONB NOT NULL,
    delivery_meta   JSONB,
    error           TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries    ENABLE ROW LEVEL SECURITY;
-- policies analogous to other tables
```

#### Public API keys (customer-issued, distinct from Aquila API keys)

```sql
-- 0011_public_api_keys.sql
CREATE TABLE public_api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL UNIQUE,
    key_prefix      VARCHAR(16) NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_pk_workspace ON public_api_keys(workspace_id) WHERE revoked_at IS NULL;
ALTER TABLE public_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY pk_workspace ON public_api_keys FOR ALL
  USING (workspace_id = current_setting('synterra.workspace_id', true)::UUID);
```

#### Webhook subscriptions (customer-defined webhooks Synterra delivers)

```sql
-- 0012_webhooks.sql
CREATE TABLE webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    secret          TEXT NOT NULL,    -- HMAC signing secret (encrypted at rest)
    event_types     TEXT[] NOT NULL,  -- ['research.complete', 'change.detected', ...]
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count   INT NOT NULL DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL,
    event_type      VARCHAR(80) NOT NULL,
    payload         JSONB NOT NULL,
    response_code   INT,
    response_body   TEXT,
    attempt         INT NOT NULL DEFAULT 1,
    succeeded_at    TIMESTAMPTZ,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### B.3 RLS enforcement convention

Every Drizzle query lives behind a `withWorkspaceContext()` helper:

```typescript
// packages/db/src/context.ts
export async function withWorkspaceContext<T>(
  workspaceId: string,
  userId: string,
  fn: (db: DrizzleClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('synterra.workspace_id', ${workspaceId}, true)`);
    await tx.execute(sql`SELECT set_config('synterra.user_id',      ${userId},      true)`);
    return fn(tx);
  });
}
```

**Rule:** No service-layer code accesses Drizzle directly. All access goes through `withWorkspaceContext` — enforced by ESLint rule + a CI grep gate.

**Service-role escape hatch** (limited, audited): a `serviceRoleQuery()` helper using a separate Postgres role that bypasses RLS, used *only* by:
- BullMQ workers writing `usage_events` (no workspace context)
- Stripe webhook handler creating subscriptions
- Admin impersonation paths (logged to `audit_log` with `actor_kind='admin_impersonation'`)

---

## Section C — Identity, AuthN, AuthZ

### C.1 Decision: better-auth + WorkOS proxy for enterprise

**Primary auth provider:** **[better-auth](https://better-auth.com)** (TypeScript-native, self-hostable, zero vendor lock-in, multi-org built-in, passkeys supported, Drizzle adapter).

**Why not Clerk:** opaque user IDs, multi-org costs extra, hard to leave (vendor lock).
**Why not Supabase Auth standalone:** Synterra Postgres is its own DB; running Supabase stack (PostgREST + GoTrue + Studio) just for auth is overkill.
**Why not Keycloak/Ory:** ops-heavy, identity-focused UI, not SaaS-product-shaped.

**Enterprise SSO (SAML/OIDC) and SCIM:** **WorkOS** (cloud, but acts as a proxy — Synterra issues its own JWTs; WorkOS only handles the SAML negotiation). Switched on per-workspace at the **Scale** plan level. SCIM provisioning via WorkOS Directory Sync auto-creates `users` rows + `workspace_members`.

### C.2 AuthN flows

**Sign-up methods (all enabled day 1):**
1. **Email + magic link** (default — passwordless, no password reset hell)
2. **Email + passkey** (WebAuthn, primary path going forward)
3. **Google OAuth** (one-click for the marketers we target)
4. **GitHub OAuth** (for technical buyers)
5. **SAML/OIDC** (WorkOS, gated to Scale plan)
6. **Email + password** (kept as fallback; not promoted in UI)

**Session model:**
- HTTP-only secure cookie (`synterra_session`), 30-day rolling refresh, 24h JWT lifetime.
- Session record in Postgres (`auth_sessions`, managed by better-auth) with `device_label`, `last_seen_ip`, `revoked_at`.
- Settings → Security shows all active sessions; one-click revoke.

**Multi-workspace JWT issuance:**
- After login, Synterra issues a session cookie scoped to *user identity only* (no workspace claim).
- When user selects/switches workspace via the switcher, Synterra issues a **scoped JWT** stored in a second cookie `synterra_workspace_jwt` (15-minute TTL, refreshed on activity), claims: `{sub, email, role, workspace_id, aquila_org_slug, plan_id, exp}`.
- Synterra Server Components/Actions read both cookies; RLS context comes from the workspace JWT.
- All Aquila API calls use a **further-scoped JWT** (60-second TTL) minted just before the call, so a stolen browser cookie cannot directly hit Aquila.

### C.3 AuthZ: three layers

**Layer 1 — Workspace membership (binary):** is the user a member of this workspace? Enforced by RLS + middleware.

**Layer 2 — RBAC (six roles, hierarchical):**

| Role | Read | Comment | Edit content | Manage members | Manage billing | Delete workspace |
|---|---|---|---|---|---|---|
| `owner`   | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin`   | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `manager` | ✓ | ✓ | ✓ | invite only | ✗ | ✗ |
| `editor`  | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `viewer`  | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `guest`   | scoped | scoped | scoped | ✗ | ✗ | ✗ |

`guest` is for external collaborators (agencies sharing one client artifact). Permissions defined per-resource via a `resource_acls` table (added in v1.5 when external sharing ships — see workstream W12).

**Layer 3 — Plan/feature gates:** plan-defined `features` array (e.g., `['sso', 'audit_log', 'public_api', 'priority_queue']`) checked by `requireFeature(workspace, 'sso')` middleware. Returns clean upgrade-CTA error.

**Layer 4 (defense in depth) — Quota checks:** `requireCredits(workspace, cost)` middleware checks `workspace_quotas` *before* enqueuing any cost-incurring action. Soft limit shows warning UI; hard limit blocks + offers add-on credits purchase.

### C.4 Audit + compliance trail

- Every `workspace_members` change → `audit_log` row.
- Every `subscriptions` change → `audit_log` row.
- Every admin impersonation session → opens an `audit_log` row at start + close, all actions during session tagged with `actor_kind='admin_impersonation'`.
- Audit log retention: 7 years for billing-affecting actions, 2 years for member changes, 1 year for content edits. Configurable per workspace at Enterprise plan.

---

## Section D — Workspace Lifecycle & Onboarding

### D.1 Self-serve signup → first wow in ≤ 90 seconds

```
T=0s     User lands on synterra.app/start
         ┌─────────────────────────────────────────────────────┐
         │  "What's your company website?"                    │
         │   [https://acme.com                            ]   │
         │   [   Start Now →   ]                              │
         └─────────────────────────────────────────────────────┘

T=2s     URL submitted (anonymous): Synterra issues an `inflight_bootstrap` row
         keyed by sessionId. Calls Aquila /research with depth=light, anon org
         (`synterra_anon`), gets `run_id`. Returns user to:
         ┌─────────────────────────────────────────────────────┐
         │  We're analyzing acme.com…                          │
         │  ▓▓▓▓▓▓░░░░  fetching homepage                      │
         │  Tell us about you while we work:                   │
         │   Email: [_________________________]                │
         │   Name:  [_________________________]                │
         │   [ Send magic link → ]                             │
         └─────────────────────────────────────────────────────┘

T=15s    Aquila pipeline (light depth) returns: brand DNA, top 3 competitors,
         brand voice draft. Synterra writes preview to `inflight_bootstrap.result`.

T=30s    User clicks magic link in email → lands authenticated on:
         ┌─────────────────────────────────────────────────────┐
         │  Welcome to Acme's workspace                        │
         │  We've already learned this:                        │
         │                                                     │
         │  Industry: DTC men's grooming                       │
         │  Tone: confident, ironic, premium                   │
         │  Top competitors: Harry's, Bevel, Manscaped         │
         │  12 changes detected on competitor sites in last    │
         │      30 days                                        │
         │                                                     │
         │  [ Invite your team → ]   [ Start exploring → ]     │
         └─────────────────────────────────────────────────────┘

T=60s+   User invites team or jumps straight into Battlecards / Brand Voice tools.
         Trial = 14 days, 500 credits, no credit card required.
```

**Why this matters:** Jasper's onboarding takes 4-6 minutes and shows nothing personalized. Notion shows an empty canvas. **The first thing the user sees in Synterra is *correct intelligence about their own brand*** — generated by the Aquila engine they're paying for.

**Engineering details for the bootstrap path:**
- The anonymous URL submission happens against a special `synterra_anon` Aquila org with strict per-IP rate limit (5 light scrapes per IP per hour; Cloudflare WAF rule + Synterra middleware double-check).
- The `inflight_bootstrap` row is GC'd after 24h if not claimed by signup completion.
- On signup completion, Synterra:
  1. Creates `users` row.
  2. Creates `workspaces` row with `bootstrap_state='running'`.
  3. Calls Aquila `POST /orgs` with `{slug, name, plan: 'trial'}` (admin token, S2S only).
  4. Calls Aquila `POST /orgs/{slug}/api-keys` to mint workspace's Aquila key.
  5. Encrypts and stores in `aquila_credentials`.
  6. Re-runs the brand intelligence pipeline against the user's *real* workspace org (deeper depth this time).
  7. Streams progress to user via Supabase Realtime.
  8. Marks `bootstrap_state='ready'` when done; flips `trial_ends_at` to NOW + 14 days.

**Why not deep depth on first run:** light depth = ~15 seconds (fits the 90-second TTW); deep depth = ~3-5 minutes. Light gives us "yes, we get your brand"; deep gives us "and here are 47 actionable insights" 5 minutes later — *while the user is already invested.*

### D.2 Workspace lifecycle states

```
   ┌────────────┐
   │  pending   │  signup started, magic link not clicked
   └──────┬─────┘
          ↓
   ┌────────────┐
   │ provisioning ─→ failed → deleted_at after 24h
   └──────┬─────┘
          ↓ (Aquila org + API key created, bootstrap launched)
   ┌────────────┐
   │ trialing   │  14-day trial; full feature access; usage capped at trial quota
   └──────┬─────┘
          ↓ trial converts (CC added) | trial expires (no CC)
   ┌──────────┐  ┌──────────┐
   │  active  │  │  expired │ → grace 7 days → suspended
   └────┬─────┘  └──────────┘
        ↓ payment fails 3x | cancel requested
   ┌──────────┐
   │ past_due │ → 14 days → suspended
   └────┬─────┘
        ↓
   ┌──────────┐
   │suspended │  read-only, no new actions, banner everywhere
   └────┬─────┘
        ↓ owner reactivates (pays) | 60 days
   ┌──────────┐
   │ deleted  │  soft-delete; data retained 30 days for recovery
   └────┬─────┘
        ↓ 30 days
   ┌──────────┐
   │  purged  │  hard delete from Synterra + Aquila org disabled
   └──────────┘
```

The `workspace-provisioner` BullMQ worker drives all transitions. State changes write to `audit_log`.

### D.3 Workspace switcher UX (Slack/Linear-class)

- Top-left button: workspace logo + name + chevron.
- Click → command-palette-style overlay (kbd `Ctrl+K, W` for power users):
  - Recent workspaces (3 most recently active)
  - All workspaces (paginated, fuzzy-searchable for agencies with 50+)
  - "Create new workspace" CTA (gated by plan: Starter = 1 workspace, Growth = 3, Scale = unlimited)
  - "Join workspace by invite" (paste invite link)
- On switch: Synterra reissues `synterra_workspace_jwt`, re-routes to current workspace's last-visited page (persisted in `users.preferences`).

### D.4 Multi-workspace data model (the agency case)

A Synterra `users` row can be a member of N workspaces. An agency user `gonzalo@nova.com` might be:
- `owner` of "Nova Agency HQ" (their internal workspace)
- `admin` of "Acme Inc" (a client they manage)
- `editor` of "Beta Corp" (another client)
- `viewer` of "Gamma LLC" (a prospective client they're pitching)

Each workspace has its own Aquila org → independent brand intelligence, independent billing, independent quotas. Switcher shows all four; cmd+K can fuzzy-search across them; a single Notification Inbox aggregates events across all four (filterable per workspace).

---

## Section E — Aquila Integration Contract

### E.1 The contract (never hand-wavy)

Synterra communicates with Aquila over HTTPS only, using these endpoints (all already exist or are explicit Aquila-change items):

| Synterra need | Aquila endpoint | Auth | Status |
|---|---|---|---|
| Create workspace's Aquila org | `POST /orgs` | Admin JWT (Synterra service account on Aquila) | exists |
| Issue Aquila API key for workspace | `POST /orgs/{slug}/api-keys` | Admin JWT | exists |
| Rotate workspace API key | `DELETE /orgs/{slug}/api-keys/{id}` + `POST` | Admin JWT | exists |
| Trigger research run | `POST /research` | Workspace JWT | exists |
| Poll research status | `GET /research/{run_id}` | Workspace JWT | exists |
| Stream research events | (new) `GET /research/{run_id}/stream` (SSE) | Workspace JWT | **AQUILA CHANGE** |
| Get brand snapshot | `GET /brands/{brand_id}` | Workspace JWT | exists |
| List competitors | `GET /brands/{brand_id}/competitors` | Workspace JWT | exists |
| Subscribe to change events | `PUT /orgs/{slug}/webhooks/change_events` | Admin JWT | exists |
| Get usage report (cost attribution) | (new) `GET /orgs/{slug}/usage?since=...` | Admin JWT | **AQUILA CHANGE** |
| Exchange API key for short-lived JWT | (new) `POST /auth/issue-service-token` | API key | **AQUILA CHANGE** |

### E.2 Aquila changes required (open `Aquila/tasks/todo.md` items, not Synterra's repo)

These three items must land in Aquila *before* Synterra integration is complete. They are tracked as Aquila tasks. Synterra's plan calls them out so the orchestrator can schedule them.

**AQ-1: `POST /auth/issue-service-token` endpoint**
- Accept: `Authorization: Bearer <api_key_plaintext>`
- Validate: hash + lookup in `org_api_keys`, check `is_active`, check `expires_at`
- Issue: short-lived (60s) JWT with `{sub: api_key_id, org_id, scopes, exp}`
- Update: `org_api_keys.last_used_at`
- Rationale: today Synterra would need to re-implement Aquila JWT signing; this endpoint puts issuance inside Aquila where the secret lives.

**AQ-2: `GET /research/{run_id}/stream` (Server-Sent Events)**
- Stream events: `{type: 'progress', step: 'scraping', percent: 35}` and on completion `{type: 'complete', result_url: '/research/{run_id}'}`
- Backed by Redis pub/sub channel `aquila:run:{run_id}:events` (workers publish to this on each step transition).
- Synterra Web subscribes via Supabase Realtime *or* native SSE — either works; SSE is simpler.

**AQ-3: `GET /orgs/{slug}/usage?since=...&until=...&granularity=hour`**
- Returns aggregated counts of metered events: `{ai_tokens: int, scrapes: int, llm_cost_usd_micros: int, ...}`
- Aquila already has metric primitives (per-worker logs, Prometheus); this endpoint surfaces them as JSON for Synterra's metering pipeline.
- Backed by Aquila's existing OTel/Prometheus metric stream + a small aggregation cache.

These are filed in `Aquila/tasks/todo.md` as a new section "Aquila changes for Synterra integration" with the same `[x]/[ ]` convention.

### E.3 Synterra-side: typed Aquila client

`packages/aquila-client/` is a typed TypeScript wrapper:

```typescript
// packages/aquila-client/src/index.ts
export class AquilaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenProvider: () => Promise<string>,
  ) {}

  async submitResearch(input: ResearchRequest): Promise<{ run_id: string }> { /* ... */ }
  async getResearch(run_id: string): Promise<ResearchResult> { /* ... */ }
  streamResearch(run_id: string): ReadableStream<ResearchEvent> { /* ... */ }
  async getBrand(brand_id: string): Promise<BrandSnapshot> { /* ... */ }
  async listCompetitors(brand_id: string): Promise<Competitor[]> { /* ... */ }
  async getUsage(since: Date, until: Date): Promise<UsageReport> { /* ... */ }
}

// Per-request factory: tokenProvider() mints a fresh 60s JWT via AQ-1.
export async function aquilaForWorkspace(workspaceId: string): Promise<AquilaClient> {
  const creds = await loadAquilaCredentials(workspaceId);  // reads aquila_credentials, decrypts secret
  return new AquilaClient(
    env.AQUILA_BASE_URL,
    async () => exchangeApiKeyForJwt(creds.api_key_secret),  // calls AQ-1
  );
}
```

**Resilience:** circuit breaker (3 consecutive failures → open for 60s), retries with exponential backoff for idempotent reads (max 3), no retries for non-idempotent writes (relies on `Idempotency-Key` header).

**Observability:** every Aquila call is wrapped in an OTel span with attributes `synterra.workspace_id`, `aquila.org_slug`, `aquila.endpoint`, `aquila.run_id` — propagated to Aquila via `traceparent` header so traces span both services.

### E.4 Per-tenant Aquila knowledge surface

Each workspace's data already lives in Aquila:
- **Postgres** `brand_intelligence` filtered by `org_id = workspace.aquila_org_slug`
- **Neo4j** nodes/relationships keyed `(org_id, ...)`
- **Qdrant** `kb_verified` / `kb_exploratory` filtered by `org_id` payload
- **Per-org webhooks** subscribing to change events

Synterra never queries Aquila's databases directly. It always goes through Aquila API. (Design rule: if a query would be expensive across HTTP, the right answer is to add an Aquila endpoint that returns the rolled-up shape, not to give Synterra direct DB access.)

---

## Section F — Billing & Metering

### F.1 Plan structure

| Plan | Price (USD/mo) | Seats | Workspaces | Credits/mo | Key features |
|---|---|---|---|---|---|
| **Trial** | free, 14 days | 3 | 1 | 500 | full Growth feature set |
| **Starter** | $49/mo or $490/yr | 3 | 1 | 1,000 | core tools, weekly digest, in-app notifications |
| **Growth** | $199/mo or $1,990/yr | 10 | 3 | 8,000 | + competitor monitoring, public API, webhooks, Slack integration |
| **Scale** | $499/mo or $4,990/yr | 25 | unlimited | 30,000 | + SSO/SAML, SCIM, audit log export, priority queue, white-label exports |
| **Enterprise** | custom | unlimited | unlimited | custom | + dedicated tenancy, custom SLA, dedicated CSM, custom retention |

**Add-ons (à la carte):**
- Extra seat: $15/seat/mo
- Credit pack: $50 / 5,000 credits (top-up, never expires until plan downgrade)
- Dedicated DB tenancy: +$500/mo
- Custom subdomain (`acme.synterra.app`): included Growth+
- Custom domain CNAME (`brand-intel.acme.com`): included Scale+

**Why credits, not raw API calls:** simpler UX, predictable spend, lets us re-weight cost as our backend costs change. Internally, 1 credit ≈ $0.005 of our actual cost (LLM tokens, scrape, storage).

### F.2 Metering architecture

```
Aquila workers emit metric per action  ─┐
                                         ▼
                              ┌──────────────────┐
                              │  Aquila exposes  │
                              │  GET /orgs/{}/   │
                              │  usage           │  (AQ-3)
                              └────────┬─────────┘
                                       │
              every 60s, BullMQ        │
              "usage-aggregator"  ─────┘
              job pulls per-workspace
                                       │
                                       ▼
                       ┌──────────────────────────┐
                       │  Synterra DB:            │
                       │  - INSERT into           │
                       │    usage_events          │
                       │  - UPDATE                │
                       │    workspace_quotas      │
                       └──────────┬───────────────┘
                                  │
                                  ▼
                       ┌──────────────────────────┐
                       │  Lago (self-hosted):     │
                       │  POST /events            │
                       │  with idempotency_key    │
                       └──────────┬───────────────┘
                                  │
                                  ▼
                       Stripe (via Lago):
                       monthly invoice draft
                       finalized day 1 each month
```

**Idempotency:** `usage_events.idempotency_key = '{workspace_id}:{aquila_event_id}'` — repeated aggregations produce zero duplicates.

**Quota enforcement (hard real-time):**
1. Synterra Server Action receives "Generate brand voice" request.
2. Check `workspace_quotas.credits_consumed >= credits_granted - cost`?
   - **Soft (90%)**: dispatch action + show inline warning UI.
   - **Hard (100%)**: block, return JSON `{error: 'quota_exceeded', upgrade_url, topup_url}`, render upgrade modal.
3. Optimistically debit `workspace_quotas.credits_consumed += cost` *before* enqueuing Aquila call (with compensating decrement on Aquila failure).
4. Real consumption reconciled by aggregator job within 60s.

**Why double-bookkeep (Synterra `usage_events` AND Lago):** Synterra `usage_events` is for fast in-app analytics (what did I spend on this week?). Lago is the source of truth for invoicing. Periodic reconciliation alerts if drift > 0.5%.

### F.3 Stripe wiring

- Stripe Customer per workspace (1:1).
- Stripe Subscription per workspace.
- Webhooks endpoint: `POST /api/webhooks/stripe` → BullMQ `stripe-events` queue → idempotent processor.
- Customer portal: Stripe-hosted for v1 (handles updates, invoices, dunning); custom-built billing UI inside app for in-context upgrades.
- Tax: Stripe Tax enabled (3% fee, worth it vs. tax compliance time).
- Dunning: Stripe Smart Retries + custom in-app banner when subscription is `past_due`.

### F.4 Lago self-hosted deployment

- Runs in same LXC as Synterra (or sibling LXC if isolation needed).
- Postgres for Lago is a *separate database* in the same Postgres instance.
- Lago dashboard accessible only to Synterra admins via VPN/Tailscale (not public).
- Replication concern: Lago is the source of truth for invoicing — nightly backup to S3 + offsite.

---

## Section G — Notifications & Retention Engine

### G.1 The retention thesis

Jasper retains because users come back weekly to write campaigns. **Synterra retains because the world keeps changing and Synterra is the only place that knows when your competitors moved.**

Retention loops:
1. **Weekly Brand Pulse digest** (every Monday 8am workspace timezone): "3 competitors made changes this week, here's what."
2. **Real-time change alerts**: competitor posts new pricing → in-app notification + optional email/Slack.
3. **Suggested next actions**: "Your competitor just changed positioning — generate a counter-positioning brief?" (one-click, uses Aquila pipeline).
4. **AI-prepared drafts ready Monday**: pre-generated content suggestions waiting in inbox each week.
5. **Trend reports**: monthly automated industry trend report (from Aquila news/social workers).

### G.2 Channels

| Channel | Use cases | Implementation |
|---|---|---|
| **In-app** | All events; the inbox is the central UI | Supabase Realtime subscription on `notification_deliveries` |
| **Email** | Weekly digest, important alerts, billing | Resend + React Email templates |
| **Slack** | Real-time alerts for active workspaces | Slack OAuth app (Growth+ feature) |
| **Webhook** | Customer-defined HTTP endpoints | Internal `webhook-dispatcher` BullMQ worker (Section H) |
| **SMS** (future) | Critical-only, opt-in | Twilio (post-launch decision) |

### G.3 User preferences

Each user × workspace × event_type × channel has a row in `notification_subscriptions` (default ON for in-app, OFF for email/slack/webhook unless opted in). Settings → Notifications shows a matrix UI to manage.

### G.4 Engine

- **Event sources:** Aquila webhooks (change events, research complete) + Synterra-internal events (member invited, plan changed, quota reached).
- **Dispatcher:** BullMQ `notification-dispatcher` worker fans out events to subscribed channels.
- **Aggregation:** "Brand Pulse" weekly digest is a separate BullMQ scheduled job (cron `0 8 * * 1` per workspace timezone).
- **Delivery tracking:** every send creates a `notification_deliveries` row; bounce/failure handling for email triggers retry then disable.

---

## Section H — Public API, Webhooks, SDK

### H.1 Public REST API

Synterra exposes `https://api.synterra.app/v1/*` for customers to integrate.

**Auth:** `Authorization: Bearer sntr_<env>_<rand>` — keys created in workspace UI, scoped, expirable.
**Rate limit:** per workspace (1000 req/min Growth, 5000 req/min Scale).
**Idempotency:** all POST/PATCH/PUT accept `Idempotency-Key` header (stored 24h in Redis).
**Error format:** RFC-7807 problem+json.
**Versioning:** URL-based `/v1/`; minor versions are backward compatible; breaking changes require `/v2/`.

**v1 endpoints (initial surface — kept tight, opinionated):**

| Endpoint | Purpose |
|---|---|
| `GET /v1/workspaces/me` | current workspace metadata |
| `GET /v1/brands` | list workspace's brands |
| `GET /v1/brands/{id}` | brand snapshot (DNA, voice, competitors) |
| `POST /v1/research` | trigger research run on a URL |
| `GET /v1/research/{run_id}` | poll status |
| `GET /v1/research/{run_id}/stream` (SSE) | live progress |
| `GET /v1/competitors` | list tracked competitors |
| `GET /v1/changes?since=...` | competitor changes feed |
| `POST /v1/generate/brand-voice` | LLM generation in workspace's voice |
| `GET /v1/usage` | current period quota + consumption |
| `POST /v1/webhooks` / `GET` / `DELETE` | manage webhook endpoints |

### H.2 Webhooks (outbound from Synterra to customer)

- HMAC-SHA256 signed (`X-Synterra-Signature: t=<timestamp>,v1=<hmac>`).
- 10s timeout, 8 retries with exponential backoff over 24h.
- Replay protection: 5-minute timestamp window.
- Customer can mark a delivery "manually retried" from the dashboard.
- `webhook_deliveries` table is the durable log; UI shows recent deliveries with payload + response.

### H.3 SDKs

- **TypeScript** (`@synterra/node`) — published to npm, generated from OpenAPI spec.
- **Python** (`synterra-py`) — published to PyPI, same generation.
- **CLI** (`synterra` binary) — wraps the TS SDK, useful for ops + agency scripts.

OpenAPI spec generated from Hono route handlers via `@hono/zod-openapi`. Publishing pipeline regenerates SDKs on every API change in CI.

### H.4 Public docs

- `docs.synterra.app` — Mintlify-hosted (or Nextra; decide at scaffold time), auto-rebuilt on OpenAPI change.
- Cookbook section: "How to embed brand DNA in your CMS", "Auto-generate weekly competitor reports", etc.
- Live API explorer (Try It buttons) using user's workspace key.

---

## Section I — Admin / Internal Control Plane

### I.1 The internal admin app

`admin.synterra.app` — separate Next.js route group, behind Cloudflare Access (Zero Trust SSO via Google Workspace) + IP allowlist (office + Tailscale).

Capabilities:
- **Workspace explorer**: search, filter by plan/status/created date/usage; deep-link into any workspace.
- **Impersonation**: 1-click "Sign in as workspace owner" (logs `audit_log` rows, banner in workspace UI: "You are being viewed by Synterra Support — Gonzalo Diaz").
- **Plan changes**: manually upgrade/downgrade, grant credits, override quotas.
- **Refunds**: trigger Stripe refund + dunning suppression.
- **Suspension**: per-workspace; reason captured; banner shown to all members.
- **Feature flags**: per-workspace boolean flags (early-access, custom features).
- **Usage attribution**: dashboards showing top spenders, margin per workspace, cost per LLM call.
- **Aquila health**: Aquila API up/down, queue depth, worker health (mirrored from Aquila's Grafana).
- **Support**: customer comms timeline (linked to Linear/HelpScout if integrated).
- **Migration tools**: export workspace data, move to dedicated DB, run data fixes.

### I.2 Why a separate app

- Strict access (no customer-shared routes).
- Different auth (admin-only Google SSO via Cloudflare Access).
- Different RLS context (uses service role; every action audited).
- Can be ugly/dense — built for ops speed, not customer polish.

---

## Section J — Security & Compliance

### J.1 Threat model (top risks, mitigations)

| Threat | Mitigation |
|---|---|
| Cross-tenant data leak (the #1 SaaS lawsuit risk) | RLS at Postgres + workspace context middleware + automated test suite verifying every endpoint enforces workspace scope |
| Stolen browser session | Short-lived workspace JWT (15min), HTTP-only cookies, IP-binding for Scale plan, session revocation UI |
| Stripe webhook spoofing | Signature verification; webhook secret per env in Infisical |
| Synterra → Aquila token leak | Per-workspace API keys (not master token), 60s JWT exchange, automatic rotation every 90 days |
| Customer-uploaded SSRF | URL validation via Aquila's existing `is_ssrf_safe()`; never let user input reach our internal network |
| Mass account creation (signup abuse) | Cloudflare Turnstile on signup form; per-IP rate limit; email verification mandatory before any Aquila call |
| LLM prompt injection (in scraped content) | Aquila already wraps scraped content in `<scraped_content>` tags + system prompt instructions (existing C5 fix); Synterra inherits |
| Public API key leak | Prefix-visible, full-key shown once; periodic scanner detects keys in public GitHub via GitGuardian-equivalent |
| Insider threat (internal admin) | All admin actions audited; periodic admin-action review; least-privilege admin roles |

### J.2 Encryption

- **In transit:** TLS 1.3 everywhere (Cloudflare-terminated; origin via Cloudflare Tunnel).
- **At rest:** Postgres TDE not used (premium feature) — instead, application-layer envelope encryption for sensitive columns (`aquila_credentials.api_key_secret_enc`, `webhook_endpoints.secret`, `notification_subscriptions.config` for slack tokens). KMS root key in Infisical, data keys cached.
- **Backups:** Postgres nightly dump → Backblaze B2 (encrypted client-side with `age`).

### J.3 Compliance roadmap

- **Day 1:**
  - GDPR-ready: DPA template, sub-processor list page, data export endpoint (`POST /v1/workspaces/me/export` returns ZIP), delete-my-data endpoint (cascade delete, 30-day grace).
  - Cookie consent banner (Cookiebot or self-hosted equivalent).
  - Privacy policy + Terms of Service drafted by legal.
- **Month 3:**
  - Vanta or Drata onboarded; SOC 2 Type II audit window opens.
  - Vulnerability scanning in CI (Snyk or Trivy).
  - Annual penetration test commissioned.
- **Month 12:**
  - SOC 2 Type II report available.
  - HIPAA evaluation (only if healthcare customers ask).

### J.4 Audit log integrity

- Append-only (no UPDATE/DELETE permitted by DB role).
- Hash chain every 1000 rows (each row's hash includes previous row's hash) — tampering detectable.
- Daily off-site replication.

---

## Section K — Observability

### K.1 Stack

Synterra plugs into **the same** Prometheus + Loki + Grafana that Aquila already runs. No new vendor.

- **Logs:** Pino (Node) → JSON stdout → Promtail → Loki, with `trace_id` and `workspace_id` on every line.
- **Metrics:** OpenTelemetry SDK → Prometheus `/metrics` endpoint → Prometheus scrape.
- **Traces:** OTLP HTTP exporter → Tempo (added to existing stack) → Grafana trace view.

Every span has these attributes:
- `synterra.workspace_id`
- `synterra.user_id` (when applicable)
- `synterra.plan_id`
- `synterra.action` (e.g., `research.submit`, `billing.subscription.update`)
- `aquila.org_slug` (when crossing into Aquila)

### K.2 Dashboards (in Grafana, infrastructure-as-code via JSON)

1. **System health**: API latency p50/p99, error rate, queue depth, DB connection pool saturation.
2. **Per-workspace usage**: top 20 workspaces by credit consumption, cost-to-revenue ratio.
3. **Onboarding funnel**: signup → email click → workspace created → first action → invite sent → upgraded.
4. **Billing health**: MRR, churn, expansion, dunning.
5. **Aquila integration**: per-endpoint latency, circuit-breaker opens, JWT exchange rate.
6. **Notification delivery**: send rate per channel, bounce rate, webhook failure rate per endpoint.

### K.3 Alerting

Grafana Alerting → SMTP (using the Aquila SMTP path being built per `Aquila/tasks/todo.md`) + PagerDuty (paid for the on-call team — the user). Rules:

- `error_rate > 1% for 5min` → page
- `aquila_circuit_breaker_open > 30s` → page
- `db_connections_used > 80%` → warn
- `bullmq_queue_depth > 5000` → warn
- `webhook_delivery_failure_rate > 10%` → warn
- `subscription_failed_payment` → notify (no page)

---

## Section L — Frontend Architecture

### L.1 Stack

- **Next.js 16** App Router, RSC + Server Actions.
- **TypeScript strict**.
- **Tailwind CSS** + **shadcn/ui** as base; Synterra design system extends (custom theme, motion).
- **TanStack Query** for client cache (paired with RSC: server-prefetched then hydrated).
- **Zustand** for ephemeral client state (workspace switcher state, modals, command palette).
- **react-hook-form** + **zod** for forms.
- **Framer Motion** for animations (used sparingly, brand voice).
- **Lucide** + **Phosphor** for icons.
- **Recharts** for analytics charts; **D3** ad-hoc for complex viz (knowledge graph).

### L.2 Key UI patterns

**Command palette (`Cmd+K`)** — first-class navigation. Actions: switch workspace, open brand, run new research, invite member, jump to settings. Shipped Day 1.

**Workspace switcher** — top-left, Slack-style. See D.3.

**Optimistic everything** — every write returns optimistic UI immediately; rollback on server error.

**Server-streamed pages** — long pages (Brand Dashboard, Competitor Feed) use Suspense + streaming so users see headers + skeletons in <100ms.

**Real-time updates** — via Supabase Realtime channels per workspace. Browsers subscribe to `workspace:{id}` channel; relevant events update local TanStack Query cache.

**Three-pane app shell** for content-heavy pages (Sidebar | Main | Inspector).

**Dark mode + light mode** — system-following by default; per-user preference.

**Locale support** — i18n from day 1 (`next-intl`). Languages at launch: English, Spanish (Argentina). Add more on demand.

### L.3 Page-by-page (initial sitemap)

```
/
├── /(marketing)
│   ├── /                      # landing
│   ├── /pricing
│   ├── /docs (proxy → docs.synterra.app)
│   └── /(legal)/{terms,privacy,dpa,subprocessors}
│
├── /(auth)
│   ├── /signin                # magic link / passkey / OAuth
│   ├── /signup → /start       # the URL-first onboarding
│   ├── /accept-invite/[token]
│   └── /verify-email/[token]
│
├── /(app)/[workspaceSlug]
│   ├── /                              # workspace dashboard
│   ├── /brands                        # list of tracked brands
│   ├── /brands/[brandId]              # brand detail (DNA, voice, assets)
│   ├── /brands/[brandId]/competitors
│   ├── /brands/[brandId]/voice
│   ├── /brands/[brandId]/changes      # change feed
│   ├── /research                      # research history
│   ├── /research/new                  # trigger new run
│   ├── /research/[runId]              # live + completed run view
│   ├── /generate/brand-voice          # AI generation tools
│   ├── /generate/battlecard
│   ├── /reports                       # weekly reports archive
│   ├── /integrations                  # Slack, Zapier, etc.
│   ├── /api-keys                      # public API keys management
│   ├── /webhooks                      # webhook endpoints
│   ├── /members                       # team management
│   ├── /billing                       # plan, usage, invoices
│   └── /settings/{general,branding,security,notifications,danger}
│
└── /admin (Cloudflare Access protected)
    ├── /workspaces
    ├── /users
    ├── /billing
    ├── /support
    └── /flags
```

---

## Section M — Infrastructure & Deployment

> **STATUS — Phase 0 (Proxmox) uses the 5-LXC topology defined in REVISION 2026-04-19 near the top of this document, NOT the 9-LXC topology below.** The 9-LXC topology is **preserved as historical reference** for the case where we ever choose to self-host production at full HA grade (probably never, given the AWS Phase 1 plan). Section M.1.1's sizing matrix (54 vCPU / 108 GB / 1.3 TB) is **superseded for Phase 0** by the 11 vCPU / 18.5 GB / 95 GB lean-but-production-grade table in the REVISION section.
>
> **For Phase 1 (AWS) infrastructure:** see the AWS architecture diagram + migration runbook in the REVISION section. AWS replaces M.1's per-LXC roles with managed services (RDS Multi-AZ for DB, ElastiCache Multi-AZ for Redis, ALB for LB, ECS Fargate for app/workers, AMP/AMG/CloudWatch for observability). M.1's HA primitives (Patroni, Sentinel, Traefik 3-replica) are not built; AWS provides them.
>
> Read the sections below for design intent + reasoning that still informs the Phase 1 AWS Terraform modules — but do not implement M.1's 9-LXC layout in Phase 0.

### M.1 LXC Topology — 9 containers, separation of concerns [SUPERSEDED for Phase 0]

Per the resolved decision "no escatimar, hacerlo perfecto", every concern gets its own LXC. This buys us:
- Independent vertical scaling per role (DB-bound? scale only the DB LXC).
- Failure isolation (app crash ≠ DB down ≠ billing down ≠ observability blind).
- HA primitives (replicas, Sentinel, multi-replica web) live in dedicated LXCs sized for their workload.
- Clean expansion path for "more Aquilas" — each new vertical AI service lands as its own LXC, plugs into Forgentic via API.

```
                                 ┌──────────────────────────────┐
                                 │  CLOUDFLARE (edge: WAF +     │
                                 │  Tunnel + Turnstile + DDoS)  │
                                 └──────────────┬───────────────┘
                                                │ Cloudflare Tunnel
                                                │ (outbound from origin)
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                            PROXMOX HOST (homelab)                                  │
│                                                                                    │
│  ┌─────────────────────────┐                ┌────────────────────────────┐         │
│  │ LXC 1  aquila.lan       │                │ LXC 2  forgentic-app.lan   │         │
│  │ (existing, 192.168.10.42)│◄──HTTPS──────│ Next.js × 3 replicas       │         │
│  │ Aquila FastAPI + 11     │  internal LAN │ (web-1, web-2, web-3)      │         │
│  │ Arq workers + Aquila    │  AQ-1/2/3     │ Traefik (LB + TLS + health)│         │
│  │ Postgres + Neo4j +      │               │ BullMQ workers (separate   │         │
│  │ Qdrant + Aquila Redis   │               │ container in same compose) │         │
│  └─────────────────────────┘               │ cloudflared (Tunnel client)│         │
│                                             └──────┬───────────┬─────────┘         │
│                                                    │           │                   │
│                          ┌─────────────────────────┘           │                   │
│                          │ pgbouncer routing                   │ Sentinel discovery│
│                          │ (writes → primary,                   │                  │
│                          │  reads → replica)                    │                  │
│                          ▼                                      ▼                  │
│  ┌──────────────────────────────────┐    ┌────────────────────────────────────┐    │
│  │ LXC 3  forgentic-db-primary.lan  │    │ LXC 5/6/7  forgentic-cache-{1,2,3} │    │
│  │ Postgres 16 master               │    │ Redis 7 + Sentinel (3-node quorum) │    │
│  │ - DB synterra (RLS, 12 tables)   │    │ - 1 master + 2 replicas + 3 sent.  │    │
│  │ - WAL archive → B2 every 5s      │    │ - Auto-failover ~30s               │    │
│  │ - pg_partman, pg_cron extensions │    │ - Backs BullMQ + sessions +        │    │
│  └────────────┬─────────────────────┘    │   Realtime pub/sub                 │    │
│               │ streaming replication    └────────────────────────────────────┘    │
│               │ (sync for critical txns,                                            │
│               │  async for the rest)                                                │
│               ▼                                                                     │
│  ┌──────────────────────────────────┐                                               │
│  │ LXC 4  forgentic-db-replica.lan  │                                               │
│  │ Postgres 16 hot standby          │                                               │
│  │ - Read replica (analytics, exports, dashboards)                                  │
│  │ - Backup source (nightly pg_dump runs here, no load on primary)                  │
│  │ - Promotable to primary on failover                                              │
│  └──────────────────────────────────┘                                               │
│                                                                                     │
│  ┌────────────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ LXC 8  metering.lan                │  │ LXC 9  observability.lan             │  │
│  │ Lago server + Lago Postgres +      │  │ Prometheus (TSDB + alertmanager) +   │  │
│  │ Lago Redis (isolated stack)        │  │ Loki (logs) + Tempo (traces) +       │  │
│  │ Source of truth for invoicing      │  │ Grafana (dashboards + alerting) +    │  │
│  │ Receives events from forgentic-app │  │ Cachet (status page backend) +       │  │
│  │ via internal HTTPS                 │  │ promtail/grafana-agent receivers     │  │
│  │                                    │  │ Receives from Aquila + Forgentic +   │  │
│  │ Dashboard reachable ONLY via       │  │ all future "vertical Aquilas"        │  │
│  │ Tailscale VPN (no public ingress)  │  │ Reachable ONLY via Tailscale         │  │
│  └────────────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**LXC inventory (target):**

| # | LXC hostname | Purpose | Containers inside (Docker Compose) |
|---|---|---|---|
| 1 | `aquila.lan` *(existing)* | Aquila data plane | unchanged — see Aquila's docker-compose |
| 2 | `forgentic-app.lan` | Forgentic app + workers + LB | `web-1`, `web-2`, `web-3` (Next.js replicas), `traefik`, `workers`, `cloudflared`, `promtail`, `grafana-agent` |
| 3 | `forgentic-db-primary.lan` | Postgres master | `postgres-primary`, `pgbackrest` (WAL archiver), `node-exporter` |
| 4 | `forgentic-db-replica.lan` | Postgres hot standby | `postgres-replica`, `pg-dump-cron`, `node-exporter` |
| 5 | `forgentic-cache-1.lan` | Redis Sentinel node 1 | `redis-master` (initially), `sentinel-1`, `node-exporter` |
| 6 | `forgentic-cache-2.lan` | Redis Sentinel node 2 | `redis-replica-1`, `sentinel-2`, `node-exporter` |
| 7 | `forgentic-cache-3.lan` | Redis Sentinel node 3 | `redis-replica-2`, `sentinel-3`, `node-exporter` |
| 8 | `metering.lan` | Lago billing engine (isolated) | `lago-api`, `lago-front`, `lago-postgres`, `lago-redis`, `node-exporter` |
| 9 | `observability.lan` | Telemetry hub for all services (Aquila + Forgentic + future) | `prometheus`, `alertmanager`, `loki`, `tempo`, `grafana`, `cachet`, `cachet-postgres`, `node-exporter` |

**Note on cache cluster:** the 3-node Sentinel quorum can either be 3 separate LXCs (recommended for true HA — survives one host failure if you ever cluster Proxmox) or 3 containers in 1 LXC sharing the host (acceptable for single-host homelab where the LXC itself is the failure domain). Default: 3 separate LXCs from day 1, since LXC creation is cheap and migration later is painful.

### M.1.1 LXC base specifications

**OS for all 8 new LXCs:** **Debian 12 (Bookworm)**, unprivileged container, Proxmox template `debian-12-standard_*_amd64.tar.zst`.

**Why Debian 12, not 13:**
- Proven LTS, supported through 2028 (security) / 2026 (regular).
- All our stack (Postgres 16, Redis 7, Docker 24+, cloudflared, Tailscale) has stable packages.
- Aquila's existing LXC runs Debian 12 — uniform runbooks, same OpenSSL/systemd quirks, ops scripts portable.
- Debian 13 (Trixie, released Aug 2025) brings nothing critical for our workloads; deferred to v1.5 alongside Proxmox cluster move.

**Required Proxmox LXC creation flags (every container):**

```
Type:         unprivileged container
Features:     nesting=1, keyctl=1
              (nesting=1 mandatory for Docker-in-LXC; keyctl=1 needed for
               BullMQ + Redis TLS + some crypto operations)
Network:      bridged on vmbr0, static IP from local DNS plan
DNS:          your local resolver (so .lan and .internal hostnames resolve)
Mount points: separate disk volume for data dirs on DB/observability LXCs
Onboot:       yes
Start order:  per table below (DBs first, app after deps up)
Backup:       included in nightly Proxmox vzdump job, 7d/4w/12m retention
```

**Per-LXC sizing matrix:**

| # | LXC | vCPU (min/rec) | RAM (min/rec) | Disk (min/rec) | Storage tier | Start order | Notes |
|---|---|---|---|---|---|---|---|
| 2 | `forgentic-app.lan` | 4 / **8** | 8 GB / **16 GB** | 40 / **80 GB** | SSD | 30 | Next.js × 3 + Traefik + workers + cloudflared |
| 3 | `forgentic-db-primary.lan` | 4 / **8** | 8 GB / **16 GB** | 100 / **200 GB** | **NVMe** | 10 | Postgres 16 master, WAL on fast disk |
| 4 | `forgentic-db-replica.lan` | 4 / **8** | 8 GB / **16 GB** | 120 / **240 GB** | **NVMe** | 11 | Hot standby + nightly pg_dump scratch space |
| 5 | `forgentic-cache-1.lan` | 2 / **4** | 4 GB / **8 GB** | 20 / **40 GB** | SSD | 20 | Redis master + Sentinel-1 |
| 6 | `forgentic-cache-2.lan` | 2 / **4** | 4 GB / **8 GB** | 20 / **40 GB** | SSD | 21 | Redis replica-1 + Sentinel-2 |
| 7 | `forgentic-cache-3.lan` | 2 / **4** | 4 GB / **8 GB** | 20 / **40 GB** | SSD | 22 | Redis replica-2 + Sentinel-3 |
| 8 | `metering.lan` | 4 / **6** | 6 GB / **12 GB** | 60 / **120 GB** | SSD | 40 | Lago API + Lago Front + Lago Postgres + Lago Redis |
| 9 | `observability.lan` | 6 / **12** | 12 GB / **24 GB** | 200 / **500 GB** | SSD (logs >7d → HDD OK) | 50 | Prometheus + Loki + Tempo + Grafana + Cachet |
| | **Total recommended** | **54 vCPU** | **108 GB** | **~1.3 TB** | | | |

**Sizing rationale (key points):**

- **NVMe is non-negotiable for both DB LXCs.** Postgres with WAL on HDD/spinning rust = unacceptable write latency. SATA SSD is acceptable; NVMe is ideal. Use Proxmox storage with `discard=on` for SSD lifetime.
- **DB primary 200 GB recommended** comfortably handles year-1 of 1-10K workspaces (multi-tenant data, audit log partitions, usage_events partitions). WAL is shipped continuously to B2, doesn't accumulate locally beyond 24h.
- **`observability.lan` is the disk hog.** Estimated 2-week retention at 100 active workspaces: Prometheus ~50 GB, Loki ~100 GB, Tempo ~50 GB. If your host has tiered storage (NVMe + HDD), route Loki/Tempo cold storage to HDD via `loki.compactor` and `tempo.storage.local`.
- **Cache LXCs are deliberately small.** Redis is RAM-bound, low CPU; 8 GB per node is generous for v1. AOF + RDB on a small SSD volume.
- **Min specs = "won't crash";** recommended = "performs well at v1 launch (~100 workspaces, ~10 req/s sustained)". Both vCPU and RAM are hot-pluggable in Proxmox — bump on the fly when monitoring shows pressure, no reinstall.

**Host budget reality check:**

If your Proxmox host can't fit the recommended 108 GB RAM / 54 vCPU / 1.3 TB:

- **Option A — co-locate the cache cluster:** collapse the 3 cache LXCs into 1 LXC running 3 Redis containers (4 vCPU / 8 GB / 40 GB total). Trade-off: lose true Sentinel HA (one LXC failure takes down all cache); acceptable on single-host homelab. Frees ~12 GB RAM, ~6 vCPU.
- **Option B — run on min specs:** ~46 GB RAM / ~28 vCPU / ~580 GB disk. Functional for dev/staging; production at 100+ workspaces will start showing latency on DB queries.
- **Option C — bump later:** start at Option A or B; bump vCPU/RAM/disk per LXC when Grafana shows pressure. Proxmox supports hot CPU/RAM resize without reboot.

**Recommendation:** if host can fit it, deploy at recommended specs from day 1. Easier to dial down underutilized LXCs than to scramble under load.

### M.1.2 Bootstrap order on a fresh host

1. Confirm Proxmox host has: NVMe pool defined, ZFS or LVM-thin storage pool, `vmbr0` bridge configured, local DNS resolver reachable (or PiHole/Unbound LXC up first).
2. Pull Debian 12 LXC template once: `pveam update && pveam download local debian-12-standard_*_amd64.tar.zst`.
3. Provision LXCs 3 → 4 → 5/6/7 → 2 → 8 → 9 in that order (DBs first so app can connect on first boot).
4. On each LXC after first boot:
   - `apt update && apt upgrade -y`
   - Install Docker + Compose plugin: `curl -fsSL https://get.docker.com | sh && apt install -y docker-compose-plugin`
   - Install Tailscale: `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up --auth-key=$TAILSCALE_AUTH_KEY` (key from Infisical bootstrap)
   - Install Infisical CLI for secret pull at boot
   - Apply per-LXC `docker-compose.yml` from `Synterra/infra/lxc-{N}/` (provisioned by W0-3 as part of the deploy script).
5. Verify with health checks before moving to next LXC: `pg_isready` on DBs, `redis-cli ping` on cache, `curl /api/health` on app.

This bootstrap is automated end-to-end in W0-3 via Ansible-style scripts (or just bash; we don't need full Ansible for 8 LXCs).

**Note on observability LXC:** consolidates the Aquila Prometheus/Loki/Grafana stack that today lives inside `aquila.lan`. Migration of Aquila telemetry to this LXC is filed as Aquila task **AQ-4** (see Section E.2 update below). Until AQ-4 lands, Aquila keeps its inline observability and `observability.lan` only serves Forgentic + Lago.

### M.2 High-availability primitives

#### M.2.1 Postgres streaming replication

- **Primary** (`forgentic-db-primary.lan`): receives all writes; streams WAL to replica.
- **Replica** (`forgentic-db-replica.lan`): hot standby in `hot_standby_feedback=on` mode; serves read-only queries.
- **Replication mode:** `synchronous_commit = remote_apply` for the `synterra` database's critical tables (`subscriptions`, `audit_log`, `usage_events`, `aquila_credentials`); `async` for the rest. Trade-off: synchronous costs ~2-5ms write latency but guarantees zero data loss on primary failure for those tables.
- **Routing:** PgBouncer in `forgentic-app.lan` LXC, transaction pooling mode, two backends:
  - `pg-write` → primary (used for all `withWorkspaceContext` calls inside Server Actions / write paths).
  - `pg-read` → replica (used by analytics / export / dashboard queries that opt in via `withWorkspaceContextReadOnly`).
- **Failover (v1, manual):** documented runbook (~5 min): promote replica via `pg_ctl promote` → update PgBouncer config → restart Forgentic web. RPO ≤ 1s for sync tables, ≤ 30s for async.
- **Failover (v1.5, auto):** Patroni + etcd cluster manages promotion automatically (~15-30s detection + promotion).
- **Backups:** nightly `pg_dump` runs against the **replica** (zero load on primary), encrypted with `age`, shipped to Backblaze B2. WAL continuous-archive via `pgbackrest` from primary → B2 every 5s. Combined gives PITR to any second in last 30 days.

#### M.2.2 Redis Sentinel HA

- **Topology:** 1 master + 2 replicas + 3 sentinels (each sentinel co-located with a Redis node).
- **Quorum:** 2 of 3 sentinels must agree to trigger failover.
- **Application discovery:** Forgentic apps connect via Sentinel (`sentinel://forgentic-cache-1:26379,forgentic-cache-2:26379,forgentic-cache-3:26379/mymaster`). On master failover, BullMQ + better-auth + Realtime auto-reconnect to the new master within ~30s.
- **Persistence:** AOF every 1s + RDB snapshot every 5min. AOF rewrite weekly during low-traffic window.
- **Backup:** RDB snapshots shipped to B2 nightly.

#### M.2.3 App-tier load balancing

- **Inside `forgentic-app.lan`:** Traefik 3.x as L7 reverse proxy + load balancer.
- **Backends:** 3 replicas of Next.js (`web-1:3000`, `web-2:3000`, `web-3:3000`) — separate Docker containers within the same LXC for v1 (not multi-host until Proxmox cluster arrives).
- **Health check:** `GET /api/health` every 5s; backend marked unhealthy after 3 consecutive failures, brought back after 3 consecutive successes.
- **Graceful drain:** SIGTERM → 30s grace period (drain in-flight requests + close DB connections cleanly) → SIGKILL.
- **Rolling deploys:** new image rolled out one replica at a time; Traefik drains the old before serving traffic to the new.
- **Sticky sessions:** NOT used — sessions live in Postgres + Redis, any replica can serve any user.
- **Cloudflare Tunnel:** points to Traefik on `https://traefik.forgentic.local:443`. CF terminates TLS to its edge; Traefik handles internal TLS; origin sees encrypted traffic.

#### M.2.4 BullMQ worker HA

- 2-3 worker container replicas in `forgentic-app.lan` (separate from the Next.js containers).
- Each worker connects to Redis Sentinel; on master failover, jobs resume from the new master.
- Job concurrency tuned per queue (Stripe webhooks: 5; email-delivery: 20; usage-aggregator: 1 with locking; notification-dispatcher: 10).

### M.3 Networking

- **Inbound from internet:** only Cloudflare Tunnel → Traefik in `forgentic-app.lan`. **No exposed ports on any LXC.** Eliminates whole classes of attacks (port scans, direct exploits, Shodan exposure).
- **Internal LAN traffic** (`forgentic-app` ↔ `forgentic-db-*` ↔ `forgentic-cache-*` ↔ `metering` ↔ `observability` ↔ `aquila`): standard HTTP within the Proxmox bridge; v1.5 upgrade to mTLS via **Tailscale tailnet** (each LXC joins the tailnet, only authenticated nodes can reach each other).
- **Outbound from Forgentic:** Stripe API, Resend, WorkOS, Cloudflare API (for cache purge), Backblaze B2 (backup target), Anthropic/OpenAI (only if direct LLM features added; default routes via Aquila).
- **Aquila ↔ Forgentic:** HTTPS over LAN. Forgentic holds per-workspace Aquila API keys; mints 60s JWT via AQ-1 per request.
- **Admin access** (Lago dashboard, Grafana, Tempo UI, Infisical): only via Tailscale — no public CF route.

### M.4 Secrets

All secrets in **Infisical** (already deployed for Aquila at `infisical.forgentic.internal`). Forgentic adds a new project `forgentic-prod` (and `forgentic-staging`, `forgentic-dev`).

Each LXC bootstraps via Infisical universal-auth (same pattern as `Aquila/Backend/infra/deploy-aquila.sh`). The `deploy-forgentic.sh` script lives in `Synterra/infra/` and is modeled on Aquila's.

**Required secrets per scope:**

| Secret | Used by | Rotation |
|---|---|---|
| `DATABASE_URL_PRIMARY` (writes) | `forgentic-app` | 90d (re-issue Postgres user pw) |
| `DATABASE_URL_REPLICA` (reads) | `forgentic-app` | 90d |
| `POSTGRES_REPLICATION_PASSWORD` | `forgentic-db-primary`, `forgentic-db-replica` | 365d |
| `REDIS_SENTINEL_PASSWORD` | `forgentic-app`, all `forgentic-cache-*` | 90d |
| `AQUILA_BASE_URL`, `AQUILA_SERVICE_ACCOUNT_TOKEN` | `forgentic-app` | 90d (Aquila admin token; used only for `POST /orgs` provisioning) |
| `BETTER_AUTH_SECRET` | `forgentic-app` | 365d (rotation invalidates all sessions — coordinate with users) |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` | `forgentic-app` | 365d |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET` | `forgentic-app` (webhooks worker) | 365d |
| `LAGO_API_KEY` | `forgentic-app` (usage-aggregator), `metering.lan` | 90d |
| `RESEND_API_KEY` | `forgentic-app` (email worker) | 90d |
| `KMS_ROOT_KEY` | `forgentic-app` (envelope encryption) | 365d (re-encrypt cycle) |
| `CLOUDFLARE_TUNNEL_TOKEN` | `forgentic-app` (`cloudflared`) | as-needed (CF dashboard) |
| `BACKBLAZE_B2_KEY_ID`, `BACKBLAZE_B2_APP_KEY` | `forgentic-db-primary` (WAL archive), `forgentic-db-replica` (dump backup) | 365d |
| `TURNSTILE_SECRET` | `forgentic-app` (signup endpoint) | as-needed |
| `GRAFANA_ADMIN_PASSWORD`, `LAGO_FRONT_AUTH` | `observability.lan`, `metering.lan` | 90d |
| `TAILSCALE_AUTH_KEY` | every LXC joining tailnet | 90d |

**Naming convention rule (from `Aquila/tasks/lessons.md` entry "Cero hardcoding"):** no IPs, hostnames, model names, providers, plan names hardcoded. Every value comes from env. Bootstrap exceptions same as Aquila: `INFISICAL_DOMAIN`, `INFISICAL_PROJECT_ID`, `INFISICAL_CLIENT_ID` (public identifiers needed before first auth).

### M.5 Deploy pipeline

- **GitHub Actions** on push to `main`: typecheck → lint → unit tests → integration tests (with Testcontainers spinning up Postgres + Redis) → Playwright E2E smoke against ephemeral env → build Docker images → push to GHCR.
- **`deploy-forgentic.sh`** (run on `forgentic-app.lan`): pulls latest images for all containers in this LXC → runs Drizzle migrations against primary (auto-rollback marker if any migration fails) → rolling restart of `web-1/2/3` (one at a time, 30s grace each) → verify `/api/health` on all three before marking deploy complete.
- **DB migrations are forward-only**; rollback strategy = restore from PITR (≤1s precision via WAL) or run a forward-fix migration.
- **Per-LXC deploy scripts:** each of LXC 3-9 has its own minimal `deploy.sh` for routine updates (Lago version bump, Grafana plugin, etc.). All wired to GitHub Actions for repeatability.
- **Blue/green for major upgrades:** `forgentic-app.lan` runs two compose stacks side-by-side (`forgentic-app-blue`, `forgentic-app-green`); Traefik routes traffic to the active color; switch is instant + rollback in 5s.

### M.6 Disaster recovery

| Failure scenario | Detection | Recovery action | RPO | RTO |
|---|---|---|---|---|
| Primary Postgres LXC down | Patroni health check (v1.5) or manual via Grafana alert (v1) | Promote replica → update PgBouncer config | ≤ 1s (sync tables) / ≤ 30s (async tables) | 5 min (manual v1) / 30s (auto v1.5) |
| Replica Postgres LXC down | Grafana alert (replication lag spike) | Re-bootstrap replica from primary base backup; backups continue from primary temporarily | 0 (primary unaffected) | 30 min (replica rebuild) |
| Redis master + 1 replica down | Sentinel quorum decides | Promote remaining replica; re-bootstrap others | ≤ 1s (AOF) | 30s |
| `forgentic-app.lan` LXC crash | Cloudflare Tunnel disconnects → CF returns 530 → Grafana alert | Restart LXC from snapshot; Tunnel auto-reconnects on boot | 0 (stateless) | 5 min |
| `metering.lan` LXC crash | Grafana alert (Lago events queue backing up in `forgentic-app.lan`) | Restart Lago LXC from snapshot; re-process queued events from Forgentic | 0 (events buffered in BullMQ + Synterra `usage_events` ledger) | 15 min |
| `observability.lan` LXC crash | External uptime monitor (`status.forgentic.io` self-check) | Restart LXC from snapshot; Promtail/grafana-agent re-buffer until back | up to 5 min of telemetry data | 15 min |
| Whole Proxmox host down | External uptime monitor pages on-call | Manual recovery: B2 restore to spare host (target: documented in `docs/RUNBOOKS/full-restore.md`); Cloudflare Tunnel re-points to new origin | ≤ 5 min (last WAL archive) | 4 hours (target for v1; reduce to 30 min when Proxmox cluster arrives in v1.5) |
| Cloudflare outage (rare but real) | External monitor + user complaints | Public status page acknowledges; no recovery action — wait for CF | 0 | dependent on CF |

**Backup test cadence:** quarterly drill — restore latest B2 backup to a staging Proxmox host, validate Synterra app comes up clean, log result in `docs/RUNBOOKS/restore-drill-log.md`.

**Snapshot strategy:** Proxmox snapshots of every LXC nightly + before every deploy. 7 daily + 4 weekly + 12 monthly retention.

### M.7 Future capacity expansion

When (not if) we outgrow single-host:
- **v1.5:** Proxmox cluster (3 hosts), enables LXC live-migration + true HA. Each LXC's primary lives on host A, replica on host B, observability on host C. Single-host failure no longer takes us down.
- **v2:** introduce **vertical "Aquila siblings"** as standalone LXCs (e.g. `image-gen.lan`, `voice.lan`, `social-publish.lan`). Each registers itself with `forgentic-app` as a **Capability Provider** via a small registration API — Forgentic discovers them, gates access via plan/quota, attributes usage events back to the right workspace. Lago + observability LXCs absorb their telemetry without code changes.
- **v2.5:** if a single workspace's data exceeds shared-DB limits, flip its `db_routing_key` and provision a dedicated Postgres LXC for it (the hybrid-tenancy escape hatch from Section B.1). The routing layer in `forgentic-app` reads `db_routing_key` and selects the right DB connection.

This "control plane + N data planes + shared metering + shared observability" is the architectural blueprint that lets Forgentic ship features at agency-tier velocity without re-architecting infra each time.

---

## Section N — Sequenced Execution Plan (Workstreams)

This is **not** an MVP-then-improve plan. It is a logical execution sequence — each workstream lands fully done before dependents start. Workstreams within the same group can run in parallel by separate subagents.

### Group 0 — Foundations (must-finish before anything else)

**W0-1: Repo + tooling skeleton**
- Initialize `Synterra/` monorepo (pnpm + Turborepo)
- Configure TS strict, ESLint, Prettier, Vitest, Playwright
- GitHub Actions: lint + typecheck + test pipelines
- Pre-commit hook (`husky` or simpler) running typecheck + format
- Acceptance: `pnpm install && pnpm build && pnpm test` runs green on a clean clone.

**W0-2: Postgres setup + Drizzle scaffold**
- Define `packages/db/` with Drizzle config
- Write migrations 0001-0012 (all schemas in §B.2)
- Write `withWorkspaceContext` helper + `serviceRoleQuery` escape hatch
- Generate Drizzle types
- Acceptance: `pnpm db:migrate` applies cleanly to a fresh Postgres; integration test verifies RLS denies cross-workspace reads.

**W0-3: Infrastructure (LXC + Docker Compose + Cloudflare Tunnel)**
- Provision LXC `synterra.lan`
- Compose stack for Postgres + Redis + Cloudflare Tunnel
- Infisical project `synterra-dev` with placeholder secrets
- `deploy-synterra.sh` modeled on Aquila's
- Acceptance: a placeholder Next.js app deploys via the script, reachable at `dev.synterra.app` through Cloudflare.

**W0-4: Observability bootstrap**
- OpenTelemetry SDK initialized in Next.js + workers
- Pino logger config
- Prometheus `/metrics` endpoint
- Promtail + grafana-agent containers configured
- Test traces visible in existing Grafana
- Acceptance: a request to a stub endpoint produces a trace span in Grafana with `synterra.workspace_id` attribute.

### Group 1 — Identity (W0 done)

**W1-1: better-auth integration**
- `packages/auth/` with better-auth configured (Drizzle adapter, sessions table, providers: magic link, passkey, Google, GitHub)
- Email provider configured (Resend, dev mode = console)
- Sign-in / sign-up routes + UI (shadcn forms)
- Acceptance: full sign-up via magic link works on dev; session persists across restarts.

**W1-2: Multi-workspace JWT issuance + middleware**
- `synterra_workspace_jwt` cookie issuance on workspace switch
- Server middleware validates both cookies + sets `synterra.workspace_id` / `synterra.user_id` for the request DB context
- Workspace switcher UI (Cmd+K + top-left dropdown)
- Acceptance: switching workspace re-routes + RLS-scoped queries return only that workspace's data.

**W1-3: WorkOS adapter (gated to Scale plan, but built day 1)**
- `packages/auth/workos.ts` adapter
- Workspace setting "Enable SSO" admin UI
- Test SAML flow with a test IdP (Okta dev account)
- SCIM webhook handler creates/updates `users` + `workspace_members`
- Acceptance: configured workspace can sign in via SAML; SCIM provisioning round-trips.

### Group 2 — Workspace lifecycle (W1 done)

**W2-1: Workspace CRUD + memberships**
- Server Actions: `createWorkspace`, `updateWorkspaceSettings`, `inviteMember`, `acceptInvite`, `changeMemberRole`, `removeMember`, `transferOwnership`
- Settings → Members UI
- Settings → General UI
- All actions audit-logged
- Acceptance: full member lifecycle works end-to-end; permission boundary tests pass for all six roles.

**W2-2: Aquila org provisioning (depends on AQ-1 in Aquila)**
- `workspace-provisioner` BullMQ worker
- On `createWorkspace`: enqueues provisioning job → calls Aquila `POST /orgs` + `POST /orgs/{slug}/api-keys` → encrypts + stores in `aquila_credentials`
- Failure handling + retry
- Acceptance: a new workspace in Synterra produces a new `organizations` row + `org_api_keys` row in Aquila; Synterra holds encrypted credentials.

**W2-3: URL-first onboarding (the 90-second wow)**
- `/start` route with anonymous URL input
- Anonymous Aquila call to `synterra_anon` org with strict per-IP rate limit (Cloudflare Turnstile + Synterra middleware)
- `inflight_bootstrap` table tracking
- Email magic link sent
- Post-signup: claim inflight result + re-run pipeline against real workspace org with deeper depth
- Live progress streaming via Supabase Realtime
- Acceptance: full flow under 90s for the "show preview" moment; under 4 minutes for the deep enrichment.

**W2-4: Workspace switcher + multi-workspace UX**
- Cmd+K palette with workspace search
- Top-left workspace dropdown
- "Last visited page per workspace" persistence
- "Create new workspace" flow (gated by plan)
- Acceptance: agency user with 5 workspaces can switch between them and Cmd+K finds the right one in <300ms.

### Group 3 — Billing (W2 done)

**W3-1: Plans + Stripe integration**
- Seed `plans` table with 5 plans
- Stripe products + prices (per env)
- Subscription creation on signup (trial first)
- Webhook handler for `customer.subscription.{created,updated,deleted}`, `invoice.{created,paid,failed}`
- Customer portal link
- Acceptance: complete trial → upgrade → invoice → downgrade → cancel cycle works end-to-end in Stripe test mode.

**W3-2: Lago self-hosted deployment**
- Lago in compose stack
- Lago API key in Infisical
- Configure plans + meters in Lago to mirror Stripe
- Acceptance: Lago dashboard reachable; events ingested via REST appear in dashboard.

**W3-3: Usage aggregator + quota enforcement (depends on AQ-3)**
- `usage-aggregator` BullMQ scheduled job (every 60s)
- Pulls `GET /orgs/{slug}/usage` per active workspace; writes `usage_events` + updates `workspace_quotas`
- Forwards events to Lago with idempotency key
- `requireCredits` middleware in Server Actions
- In-app usage dashboard
- Acceptance: a research run consumed in Aquila appears in Synterra usage dashboard within 60s; quota check blocks at 100%.

### Group 4 — Core product surface (W2 done; runs parallel with W3)

**W4-1: Brand dashboard + DNA viewer**
- `/[workspace]/brands` list page (RSC, paginated)
- `/[workspace]/brands/[id]` brand detail with DNA panel, voice profile, top competitors snapshot
- Aquila API integration for read-only data
- Acceptance: a workspace with bootstrapped data sees their brand DNA on first login.

**W4-2: Competitor monitoring + change feed**
- `/[workspace]/brands/[id]/competitors` competitor cards
- `/[workspace]/brands/[id]/changes` chronological change feed
- Subscribe Aquila webhook `change_events` → `notification-dispatcher` → in-app notif + (subscribed users) email
- Acceptance: simulated change in Aquila produces a feed entry within 5s of webhook.

**W4-3: Research run UI (live + history)**
- `/[workspace]/research/new` form (URL or brand picker)
- `/[workspace]/research/[runId]` live progress (depends on AQ-2 SSE stream)
- `/[workspace]/research` history table
- Acceptance: triggering a run shows live progress; refresh resumes from current state.

**W4-4: AI generation surface**
- `/[workspace]/generate/brand-voice` form: paste copy → "rewrite in our voice"
- `/[workspace]/generate/battlecard`: pick competitor → generate competitive battlecard
- Calls Aquila `POST /v1/generate/*` (existing or new endpoints)
- Quota debit before generation
- Acceptance: 3 generation tools work end-to-end; usage reflected in dashboard.

### Group 5 — Notifications + retention (W3 + W4 done)

**W5-1: Notification engine**
- `notification-dispatcher` worker
- In-app inbox UI (Supabase Realtime)
- Subscriptions matrix UI
- Acceptance: triggering a synthetic event shows up in inbox + subscribed channels within 3s.

**W5-2: Email templates (React Email + Resend)**
- Templates: welcome, magic link, invite, weekly digest, change alert, quota warning, payment failed
- Acceptance: each template renders + sends in dev mode; preview UI in admin.

**W5-3: Weekly Brand Pulse digest**
- Scheduled BullMQ job per workspace (cron in workspace timezone)
- Aggregates last 7 days of changes + metrics into a digest email
- Acceptance: a workspace with activity gets a digest at the configured time.

**W5-4: Slack integration (Growth+)**
- Slack OAuth app
- "Connect Slack" flow per workspace
- Per-channel routing for events
- Acceptance: a workspace can install the app, pick a channel, see test event delivery.

### Group 6 — Public API + Webhooks (W4 done)

**W6-1: Public API key issuance UI**
- `/[workspace]/api-keys` UI to create + revoke
- Acceptance: created key authenticates against `GET /v1/workspaces/me`.

**W6-2: Public API surface (v1 endpoints)**
- Hono routes under `apps/api/src/routes/v1/*`
- Zod schemas + OpenAPI generation
- Per-key rate limit (Redis sliding window)
- Idempotency middleware
- Acceptance: every v1 endpoint has integration test; OpenAPI spec generates cleanly.

**W6-3: Outbound webhooks (customer-facing)**
- `webhook_endpoints` UI
- `webhook-dispatcher` worker
- Retry policy + dead-letter
- Acceptance: customer can subscribe to `change.detected`, see deliveries in dashboard, retry from UI.

**W6-4: SDK generation pipeline**
- OpenAPI → TypeScript SDK
- OpenAPI → Python SDK
- Publish to npm + PyPI on release
- Acceptance: SDK works against staging; example notebook runs end-to-end.

**W6-5: Public docs site**
- Mintlify or Nextra at `docs.synterra.app`
- Auto-rebuilds on OpenAPI change
- Cookbook authored (5 starter recipes)
- Acceptance: docs site live; "Try it" buttons work with user's key.

### Group 7 — Admin control plane (W3 done)

**W7-1: Admin app shell + auth**
- `apps/admin/` (or route group within web)
- Cloudflare Access integration (Google Workspace SSO)
- IP allowlist
- Acceptance: only allowed Google accounts from allowed IPs can reach `/admin/*`.

**W7-2: Workspace explorer + impersonation**
- Search/filter UI
- Impersonate flow: opens workspace as that user with banner; logged to audit
- Acceptance: support flow tested end-to-end.

**W7-3: Plan/billing operations**
- Manual upgrade/downgrade, refund, suspend, grant credits
- Acceptance: operator can resolve a billing dispute without touching DB directly.

**W7-4: Feature flags + ops dashboards**
- Per-workspace flags
- Embed Aquila + Synterra Grafana dashboards
- Acceptance: flag flip propagates within 30s via Redis pub/sub to running app instances.

### Group 8 — Compliance + Security hardening (run parallel from Group 3)

**W8-1: GDPR data export + delete**
- `POST /v1/workspaces/me/export` returns ZIP with all workspace data (CSV per table + JSON metadata)
- `DELETE /v1/workspaces/me` initiates 30-day soft delete cascading to Aquila org disable
- Acceptance: export validates against schema; delete marks workspace and schedules purge job.

**W8-2: Audit log surface**
- `/[workspace]/settings/security/audit` UI (Scale+ feature)
- Export to CSV/JSON
- Hash-chain verification command in CLI
- Acceptance: an admin can review last 90 days of changes; verify-chain command confirms integrity.

**W8-3: Cookie consent + legal pages**
- Cookiebot or self-hosted equivalent
- Privacy policy, ToS, DPA, sub-processor list pages (legal-reviewed copy)
- Acceptance: consent banner appears for EU IPs; legal pages reachable.

**W8-4: SOC 2 prep (Vanta onboarding)**
- Vanta integrations (GitHub, Cloudflare, Stripe, Postgres backup verification)
- Policies authored (incident response, access review, vendor mgmt)
- Vulnerability scanner in CI
- Acceptance: Vanta dashboard shows >85% control coverage.

**W8-5: Penetration test**
- Engage external firm
- Remediate findings before launch
- Acceptance: pen test report shows no high/critical unaddressed.

### Group 9 — Marketing + launch surface (parallel from Group 4)

**W9-1: Marketing site**
- `synterra.app/` landing, `/pricing`, `/(legal)/*`
- Metrics-instrumented (PostHog or self-hosted Plausible)
- Acceptance: landing page achieves <1.5s LCP on mobile.

**W9-2: Pricing + checkout**
- Pricing page with plan comparison
- Stripe Checkout integration for self-serve upgrade
- Acceptance: full self-serve trial → paid conversion works.

**W9-3: Help center / changelog**
- HelpScout or self-hosted help center (Outline?)
- `/changelog` route (Markdown-driven)
- Acceptance: support request from app routes to HelpScout inbox.

### Group 10 — Pre-launch hardening + launch

**W10-1: Load test**
- k6 scripts simulating 1k concurrent users across 100 workspaces
- Bottleneck remediation
- Acceptance: p99 < 500ms at target load; no DB connection exhaustion.

**W10-2: Onboarding optimization**
- A/B test variants of `/start` flow
- Track funnel; iterate copy + design
- Acceptance: ≥40% URL-submission → signup-completion conversion.

**W10-3: Customer migration tooling (the 1 existing tenant: OmeletStudio)**
- Script to import OmeletStudio's existing Aquila org into Synterra (create workspace, link credentials, backfill members)
- Acceptance: OmeletStudio team uses Synterra UI on top of their existing Aquila data without disruption.

**W10-4: Public launch**
- Press: ProductHunt, Hacker News Show HN, X thread, LinkedIn post
- Coordinated with status page, capacity reserved, on-call rotation defined
- Acceptance: 24h post-launch, no p1 incidents; signup conversion within target.

---

## Section O — Subagent Team for Synterra

Mirroring Aquila's `.claude/agents/` pattern, Synterra needs its own specialized team:

| Agent | Model | Role |
|---|---|---|
| `synterra-architect` | opus | System design, RLS reviews, cross-cutting concerns |
| `synterra-orchestrator` | opus | Cross-agent briefing; reads `_memory/` of all others |
| `synterra-frontend-engineer` | sonnet | Next.js App Router, RSC, shadcn, TanStack Query |
| `synterra-backend-engineer` | sonnet | Server Actions, Hono, Drizzle, BullMQ |
| `synterra-auth-engineer` | sonnet | better-auth, WorkOS, JWT issuance, RBAC |
| `synterra-billing-engineer` | sonnet | Stripe, Lago, metering, quota enforcement |
| `synterra-aquila-bridge` | sonnet | Aquila client, JWT exchange, integration contracts |
| `synterra-test-writer` | sonnet | Playwright E2E, Testcontainers integration tests |
| `synterra-security-compliance` | sonnet | Read-only — RLS audit, secret leaks, GDPR/SOC2 prep |
| `synterra-doc-keeper` | haiku | Keeps `docs/` aligned + customer-facing API docs |

These are scaffolded as part of W0-1.

---

## Section P — Risks & Non-Goals

### P.1 Risks (top 8) and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-tenant data leak via RLS misconfig | Med | Critical | Automated test enforces every endpoint scopes by workspace; quarterly external review |
| Aquila instability blocks Synterra | Med | High | Circuit breaker; degraded mode (read cached data); status banner |
| Stripe + Lago drift causing wrong invoices | Low | High | Reconciliation job alerts >0.5% drift; manual review workflow |
| URL-first onboarding abused for SSRF/spam scrape | Med | Med | Cloudflare Turnstile + per-IP rate limit + Aquila SSRF guard inherited |
| Self-hosted infrastructure outage (single LXC host) | Low | Critical | DR runbook, B2 offsite, target RTO 30min; HA Proxmox cluster within 12mo |
| Vendor (better-auth, WorkOS, Resend) outage | Low | High | better-auth self-hosted (no provider down); Resend has 99.9% SLA + Postmark fallback documented; WorkOS only blocks SAML logins |
| Slow growth — runway pressure forces cut-corners | Med | High | Plan is sequenced; no workstream depends on later workstreams cosmetically; can pause at any group boundary without leaving system half-built |
| LLM provider price hike eating margin | Med | Med | Cost-per-credit reviewed monthly; rate card adjustable; multi-provider routing already in Aquila |

### P.2 Explicit non-goals (v1)

- **Mobile app**: web is responsive; native mobile is post-launch decision.
- **Offline mode**: not required.
- **End-user-facing collab editor (Notion-style)**: defer to v2 (Liveblocks + Yjs path documented; not built).
- **In-product chat / community**: use Discord/Slack externally for v1.
- **Marketplace of integrations** (Zapier-style): publish webhooks + API; let customers self-build for v1.
- **Custom on-prem deploy for enterprise**: dedicated tenancy = separate DB only, not separate infra. Re-evaluate if a $250K+ customer asks.
- **Multi-region failover**: single-region for v1; Cloudflare handles edge proximity.
- **Observability for end-customers (their own dashboards)**: defer; show usage + invoice for v1.

---

## Section Q — Decisions (CLOSED 2026-04-19)

All five originally-open decisions resolved by user the same day the plan was approved. Authoritative answers live in the **DECISIONS RESOLVED** block at the top of this document. Mirror summary here for quick reference:

| # | Decision | Resolution |
|---|---|---|
| 1 | Hosting model | All self-hosted on LXC; 9-LXC topology with HA primitives (DB replica + Redis Sentinel + Traefik LB). See Section M revised. |
| 2 | Pricing currency | USD base; ARS conversion at presentation layer using daily FX rate. Stripe charges USD. |
| 3 | Branding & domain | Public brand = **Forgentic**, domain = **`forgentic.io`** (Namecheap registrar, Cloudflare nameservers). "Synterra" = internal codename, never customer-visible. See "Naming Strategy" + "DNS Strategy" near top. |
| 4 | Trial CC requirement | No CC required at trial; controlled by `TRIAL_REQUIRES_CC` flag in Infisical for easy flip. |
| 5 | Aquila usage endpoint (AQ-3) | Build AQ-3 in Aquila + run billing engine (Lago) and observability stack in dedicated separate LXCs (`metering.lan`, `observability.lan`) so future "vertical Aquilas" plug into one shared metering+telemetry surface. |

**No open decisions remaining.** W0-1 can start as soon as the user gives the go-ahead.

### Newly-noted Aquila-side change (added with topology revision)

**AQ-4 (NEW): Migrate Aquila telemetry stack to `observability.lan`**
- Today Aquila runs Prometheus + Loki + Grafana inside `aquila.lan`. As Forgentic + future vertical Aquilas come online, they all need a shared observability target.
- Action: stand up `observability.lan` with Prometheus/Loki/Tempo/Grafana; reconfigure Aquila promtail/grafana-agent to ship to it; decommission Aquila's local stack; preserve dashboards via export/import.
- Filed as a new entry in `Aquila/tasks/todo.md` alongside AQ-1, AQ-2, AQ-3.
- Not blocking Forgentic (Forgentic ships its own promtail/grafana-agent pointing at `observability.lan` from day 1); only blocks Aquila telemetry consolidation.

---

## Verification — How To Know Synterra Is Done (per workstream)

Each workstream has acceptance criteria above. The aggregate launch-ready bar is:

1. **Onboarding funnel:** 100 synthetic signups → ≥80 reach "ready" workspace state in ≤5 min; ≥40 invite a teammate.
2. **Cross-tenant isolation:** automated test suite asserts every API endpoint blocks cross-workspace access (>200 test cases generated from the route table).
3. **Billing correctness:** 1000 simulated metered events match Stripe invoice within $0.01.
4. **Performance:** p99 latency <500ms at 1000 concurrent users across 100 workspaces (k6 load test).
5. **Security:** external pen test report clean of high/critical issues.
6. **Compliance:** Vanta SOC 2 control coverage ≥85%; GDPR export + delete flows tested with real EU test workspace.
7. **Customer migration:** OmeletStudio (the existing Aquila tenant) has been migrated into Synterra and uses it as their primary workspace UI for ≥30 days with zero data complaints.
8. **Documentation:** every customer-facing capability has both an in-app help link and a docs page; OpenAPI covers 100% of public endpoints.

Hit all 8 → Synterra v1 is launch-ready.

---

## Appendix A — Critical Aquila Files Referenced

For implementers working in `Synterra/`, these are the **read-only** Aquila files you'll need to understand to build the integration layer:

- `Aquila/Backend/services/api/app/deps/auth.py` — `Caller`, `require_user`, `require_org`, `require_admin`, `require_tenant` (lines 33-149) — the auth dependencies your `aquila-client` will satisfy
- `Aquila/Backend/services/api/app/routers/orgs.py` — `POST /orgs`, `POST /orgs/{slug}/api-keys`, etc. (lines 96-498) — what Synterra calls during workspace provisioning
- `Aquila/Backend/services/api/app/routers/research.py` — `POST /research`, `GET /research/{run_id}` (the workhorse endpoint)
- `Aquila/Backend/services/api/app/routers/auth.py` — `User` model, `get_current_active_admin` — used by orgs router
- `Aquila/Backend/security/api_keys.py` — `generate_api_key()`, key hashing scheme — informs Synterra's symmetric implementation
- `Aquila/Backend/infra/migrations/0006_orgs.sql` — the `organizations` + `org_api_keys` schema Synterra writes to via the API
- `Aquila/Backend/shared/lib/webhooks.py` — `dispatch()` function — pattern Synterra mirrors for outbound webhook delivery
- `Aquila/docs/omelet_granular_api.md` — the existing public API contract (Synterra v1 API is its evolution)
- `Aquila/docs/ARCHITECTURE.md` — Aquila architecture overview
- `Aquila/tasks/todo.md` — where AQ-1, AQ-2, AQ-3 land

---

## Appendix B — Memory & Lessons Imports

When starting Synterra implementation, the orchestrator should mirror these Aquila lessons into Synterra's `tasks/lessons.md`:

1. **Cero hardcoding** of IPs, hostnames, model names, providers — env-only.
2. **Antes de inventar, mirar cómo lo hizo Omelet** — Synterra inherits patterns from Omelet (SMTP delivery wrapper, Qdrant hybrid search, LLM provider routing) instead of reinventing.
3. **Infisical es source of truth** for variables.
4. **Build → Test → SaaS** ordering — this plan IS the SaaS phase, but each workstream still ships with its own tests, not as a deferred concern.
5. **Vigilar tamaño de archivos** — every Synterra source file >400 LOC requires a split rationale; every doc >800 LOC splits into sub-docs.

These imports become Synterra `tasks/lessons.md` entries 1-5 on day 1.

---

**End of plan.**

After approval, this file will be copied to `/home/diazdevivar/Projects/Forgentic/Synterra/PLAN.md`, `/home/diazdevivar/Projects/Forgentic/Synterra/docs/ARCHITECTURE.md` will be seeded from sections A-M, and the AQ-1/AQ-2/AQ-3 entries will be added to `/home/diazdevivar/Projects/Forgentic/Aquila/tasks/todo.md`.
