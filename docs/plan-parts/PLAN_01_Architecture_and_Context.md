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

User's verbatim direction (2026-04-19): _"la solucion tiene que estar 100% funcional desde esta infrastrucutre LXC de la misma forma que estara en AWS"_.

### Design principle (the one that resolves all sizing decisions)

**Anything that runs Forgentic code = production-grade in both environments. Anything that is a managed service in AWS = lean in Proxmox only because AWS operates it for us.**

| Layer                                                                                            | Runs our code?                   | Phase 0 quality bar                                                                                                                                                          | Phase 1 (AWS)                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Next.js (web)                                                                                    | ✅                               | **Production-grade**: 3 replicas, Traefik LB, health checks, graceful drain 30s, rolling deploy 1-at-a-time                                                                  | ECS Fargate auto-scaling 2-N tasks                    |
| BullMQ workers                                                                                   | ✅                               | **Production-grade**: 2 replicas, supervisor restart, idempotent jobs, dead-letter                                                                                           | ECS Fargate auto-scaling 2-N tasks                    |
| Auth · RLS · Billing pipeline · Onboarding · Webhook delivery · Notification engine · Public API | ✅ (all in Next.js)              | **Production-grade** — every contract works, every test green, every error path handled                                                                                      | Same code on ECS Fargate                              |
| Lago (3rd-party)                                                                                 | ❌ (not our code)                | **Single instance OK** — back up Lago DB nightly                                                                                                                             | ECS Fargate (1 task at this scale)                    |
| Postgres                                                                                         | ❌ (managed in AWS)              | **Single instance + production-grade backups** (continuous WAL archive to SAN + nightly base backup off-site B2) + monitoring + alertmanager. Manual restore runbook tested. | RDS Postgres Multi-AZ                                 |
| Redis                                                                                            | ❌ (managed in AWS)              | **Single instance + AOF every 1s + nightly RDB to SAN** + Sentinel-mode client config (env-only swap to AWS later)                                                           | ElastiCache Redis Multi-AZ                            |
| Load balancer (us ↔ world)                                                                       | ❌ (managed in AWS)              | **Traefik in front of 3 Next.js replicas** (full L7: health, drain, certs, /metrics)                                                                                         | ALB                                                   |
| Observability stack                                                                              | ❌ (3rd-party tools, our config) | **Production-grade**: 14-day retention, Alertmanager → email/SMS, dashboards live, status page wired                                                                         | AWS Managed Prometheus + Managed Grafana + CloudWatch |
| Cloudflare WAF + Tunnel + Turnstile                                                              | ❌ (vendor)                      | Same in both phases                                                                                                                                                          | Same                                                  |
| Secrets management (Infisical)                                                                   | ❌ (3rd-party)                   | Same in both phases                                                                                                                                                          | Same (or AWS Secrets Manager — defer)                 |

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

| LXC                   | Role                                                                                                                                                                    | Node        | vCPU        | RAM              | Disk (SAN) | AWS Phase 1 equivalent                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- | ---------------- | ---------- | ---------------------------------------------------------- |
| `forgentic-app.lan`   | **Traefik LB** + **3 Next.js replicas** (web-1/2/3) + **2 BullMQ worker replicas** + cloudflared + promtail + grafana-agent                                             | Node 2      | **4**       | **6 GB**         | **20 GB**  | ECS Fargate (web + workers, both auto-scale 2-N) + ALB     |
| `forgentic-db.lan`    | Postgres 16 single + **continuous WAL archive to SAN + nightly base backup to Backblaze B2** + node-exporter                                                            | Node 2      | 2           | 4 GB             | 30 GB      | RDS Postgres 16 Multi-AZ (db.t4g.small → bigger as needed) |
| `forgentic-cache.lan` | Redis 7 single + AOF every 1s + nightly RDB to SAN + replication lag metric (wired for AWS swap) + node-exporter                                                        | Node 2      | 1           | 1.5 GB           | 5 GB       | ElastiCache Redis 7 Multi-AZ (cache.t4g.micro)             |
| `metering.lan`        | Lago + Lago Postgres + Lago Redis (one compose) + nightly Lago DB dump to SAN                                                                                           | Node 1      | 2           | 3 GB             | 15 GB      | ECS Fargate (Lago) + RDS Postgres for Lago                 |
| `observability.lan`   | Prometheus + Loki + Tempo + Grafana + **Cachet (status page backend)** + Alertmanager → email/SMS · **14-day retention** · serves Aquila + Forgentic + future verticals | Node 1      | 2           | 4 GB             | 25 GB      | AWS Managed Prometheus + AWS Managed Grafana + CloudWatch  |
| **TOTAL**             | node 1: 4 vCPU / 7 GB / 40 GB · node 2: 7 vCPU / 11.5 GB / 55 GB                                                                                                        | **11 vCPU** | **18.5 GB** | **95 GB on SAN** |            |

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

| Phase 0 component     | AWS target                        | Migration steps                                                                                                                                                                      | Code changes                       |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `forgentic-db.lan`    | RDS Postgres Multi-AZ             | 1. Create RDS in target VPC. 2. `pg_dump` from Phase 0. 3. `pg_restore` to RDS. 4. Validate row counts + RLS via test suite. 5. Cut over via env-var swap (5min maintenance window). | None (`DATABASE_URL_*` env change) |
| `forgentic-cache.lan` | ElastiCache Redis Multi-AZ        | 1. Create ElastiCache cluster. 2. Empty Phase 0 cache (sessions reload, jobs drained). 3. Update `REDIS_SENTINEL_*` env.                                                             | None                               |
| `forgentic-app.lan`   | ECS Fargate + ALB                 | 1. Build Docker image. 2. Push to ECR. 3. ECS task definition + service. 4. ALB + target group + health check. 5. Cloudflare CNAME → ALB DNS.                                        | None (12-factor)                   |
| `metering.lan`        | ECS Fargate (Lago) + RDS for Lago | 1. Deploy Lago to ECS. 2. RDS for Lago Postgres. 3. Migrate Lago data. 4. Update `LAGO_API_URL` env.                                                                                 | None                               |
| `observability.lan`   | AMP + AMG + CloudWatch            | 1. Provision Managed Prometheus workspace. 2. Provision Managed Grafana, import dashboards. 3. Reconfigure OTel collectors → AMP endpoint.                                           | OTel exporter env change           |

**Estimated AWS monthly cost at launch (~10-100 workspaces):**

| Service                                    | Tier          | $/mo         |
| ------------------------------------------ | ------------- | ------------ |
| RDS Postgres db.t4g.small Multi-AZ         | 2 vCPU, 2 GB  | ~$60         |
| ElastiCache cache.t4g.micro Multi-AZ       | 0.5 GB        | ~$25         |
| ECS Fargate (3 tasks avg, 0.5 vCPU + 1 GB) | always-on     | ~$50         |
| ALB                                        | 1 LCU avg     | ~$25         |
| RDS for Lago db.t4g.micro                  | 1 vCPU, 1 GB  | ~$15         |
| AMP + AMG + CloudWatch Logs                | low traffic   | ~$30         |
| S3 + data transfer                         | minimal       | ~$10         |
| Route 53                                   | 1 hosted zone | $0.50        |
| **Total at launch**                        |               | **~$215/mo** |

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
5. **Aquila usage endpoint (AQ-3) — DECIDED:** Build AQ-3 in Aquila _and_ push billing/metering into a **dedicated `metering.lan` LXC** (Lago + its DB + its Redis), and observability into a **dedicated `observability.lan` LXC** (Prometheus + Loki + Grafana + Tempo). Reason: as more "vertical Aquilas" land (image gen, voice, etc.), they all need to plug into one billing+observability surface — building it as a separate LXC from day 1 makes that trivial.

---

## Naming Strategy — Synterra (internal) vs Forgentic (public)

| Where                        | Name          | Examples                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer-facing surfaces** | **Forgentic** | landing `forgentic.io`, app `app.forgentic.io`, API `api.forgentic.io`, docs `docs.forgentic.io`, admin `admin.forgentic.io`, status `status.forgentic.io`, marketing copy, transactional emails, support comms, legal docs, invoices, OG tags, page titles, OpenAPI title |
| **Internal codename**        | Synterra      | repo dir `Synterra/`, package names `@synterra/*`, subagent names `synterra-*`, Postgres database name `synterra`, internal LXC label allowed (we use `forgentic-app.lan` etc. since DNS is internal anyway), commit messages, internal docs, error log prefixes           |

**Rule (vendor names):** **never** use a third-party vendor name as a hostname, container name, env var prefix, or directory name. Always use the **role** the thing plays. Examples:

| ❌ Vendor-coupled         | ✅ Role-based      | Why                                                                                                |
| ------------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `infisical.internal`      | `secrets.internal` | If we swap Infisical for Vault, OpenBao, 1Password Connect, or Doppler, the hostname stays correct |
| `lago-dashboard.internal` | `meter.internal`   | Lago could be replaced by Orb, Metronome, custom                                                   |
| `grafana.internal`        | `metrics.internal` | Grafana could be swapped for Perses or custom                                                      |
| `LAGO_API_KEY`            | `METERING_API_KEY` | Provider-agnostic env var, vendor switch = config change only                                      |
| `RESEND_API_KEY`          | `EMAIL_API_KEY`    | Same logic; can switch to Postmark/SES without code changes                                        |

**Exception:** _inside a vendor's own Docker container or its config file_, vendor terminology is fine (`lago-postgres` as a container name within `metering.lan` LXC's compose is OK because it's literally configuring Lago). The boundary is: anything our team types in a runbook, anything that surfaces in DNS, any env var our code reads — **role-based**.

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

| Hostname              | Purpose                                                                           | Origin                                               |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `forgentic.io`        | Marketing landing (Next.js, public routes)                                        | `forgentic-app.lan` via Traefik                      |
| `app.forgentic.io`    | Authenticated workspace UI                                                        | `forgentic-app.lan` via Traefik                      |
| `api.forgentic.io`    | Public REST API + webhooks endpoint                                               | `forgentic-app.lan` via Traefik                      |
| `docs.forgentic.io`   | Mintlify/Nextra docs                                                              | `forgentic-app.lan` (or static via Cloudflare Pages) |
| `admin.forgentic.io`  | Internal admin (Cloudflare Access protected, Google Workspace SSO + IP allowlist) | `forgentic-app.lan` via Traefik                      |
| `status.forgentic.io` | Status page (Cachet self-hosted or Atlassian Statuspage)                          | `observability.lan`                                  |

**Internal-only hostnames** (LAN, never reachable from public internet):

| Hostname                     | Purpose                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `meter.forgentic.internal`   | Lago dashboard (only via Tailscale/VPN)                                                                                                        |
| `metrics.forgentic.internal` | Grafana (only via Tailscale/VPN)                                                                                                               |
| `traces.forgentic.internal`  | Tempo UI (only via Tailscale/VPN)                                                                                                              |
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
3. **Aquila has unique tools** — the SaaS layer must surface those (workspace-scoped brand DNA, competitor change feeds, on-demand research) as the _core differentiator_, not as add-ons.

Aquila is **not finished** (open items in `Aquila/tasks/todo.md`: H5 token rotation, D1-D4 maintainability, Phase 8 frontend unify, services re-audit). Synterra design must assume Aquila keeps evolving and never lock Synterra into Aquila's current shape — talk to Aquila over **versioned HTTP contracts only**.

Aquila already has 75% of the multi-tenant primitives Synterra needs:

| Aquila already provides (data plane)                                    | Synterra owns (control plane)                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `organizations` table (slug, plan, settings, is_active)                 | User accounts, multi-workspace memberships, sessions    |
| `org_api_keys` (hashed, scoped, expirable)                              | Stripe customer → workspace mapping, plan enforcement   |
| JWT with `org_id` claim + `require_user/require_org/require_admin` deps | better-auth + WorkOS, multi-workspace JWT issuance      |
| `users.org_id` FK to organizations                                      | Onboarding wizard, workspace switcher UX                |
| Per-org webhooks (HMAC-signed, dispatchable)                            | Webhook subscription UI, public webhook portal          |
| 11 Arq workers all `org_id`-scoped                                      | Workspace-scoped quota enforcement before enqueue       |
| Per-org settings JSONB                                                  | Workspace branding, integrations UI                     |
| Change-event detection per brand                                        | Notifications engine, weekly digests, alert preferences |

**This plan never modifies Aquila core code without an explicit "Aquila change" task.** Where Aquila gaps block Synterra (e.g., no `workspace_members` table, no usage event ledger, no scoped service-token issuance endpoint), the plan calls out an explicit **Aquila Change** workstream — those go through the existing `aquila-*` subagents and Aquila's own `tasks/todo.md` flow, _not_ Synterra's repo.

---

## Strategic Positioning

**Tagline (working):** _The brand-intelligence workspace your team operates from._

**Positioning vs market:**

| Competitor            | Their strength                   | Synterra's edge                                                                                                        |
| --------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Jasper / Copy.ai**  | AI writing                       | We have _brand context_ (DNA, voice, competitors, change feed) — their AI writes generic, ours writes _for your brand_ |
| **Crayon / Klue**     | Competitive intel for enterprise | We bundle competitive intel + creative generation + always-on monitoring at SMB price                                  |
| **Notion AI**         | General workspace + AI           | We're vertical (marketing/brand teams) with deep tools, not a general doc tool                                         |
| **HubSpot / Semrush** | Marketing platforms              | We don't do CRM/SEO; we own the _brand intelligence_ layer they all need to plug into                                  |
| **Linear / Asana**    | Workflow                         | We're not a tracker; we're the source of truth for _what's true about your brand and your competitors right now_       |

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
2. **Synterra never holds Aquila's static `AQUILA_INTERNAL_TOKEN`.** Synterra holds _workspace-specific Aquila API keys_ (one per workspace) and exchanges them for short-lived JWTs at request time.
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
