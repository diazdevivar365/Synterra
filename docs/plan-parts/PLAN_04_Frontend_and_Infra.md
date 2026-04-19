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

| #   | LXC hostname               | Purpose                                                      | Containers inside (Docker Compose)                                                                             |
| --- | -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 1   | `aquila.lan` _(existing)_  | Aquila data plane                                            | unchanged — see Aquila's docker-compose                                                                        |
| 2   | `forgentic-app.lan`        | Forgentic app + workers + LB                                 | `web-1`, `web-2`, `web-3` (Next.js replicas), `traefik`, `workers`, `cloudflared`, `promtail`, `grafana-agent` |
| 3   | `forgentic-db-primary.lan` | Postgres master                                              | `postgres-primary`, `pgbackrest` (WAL archiver), `node-exporter`                                               |
| 4   | `forgentic-db-replica.lan` | Postgres hot standby                                         | `postgres-replica`, `pg-dump-cron`, `node-exporter`                                                            |
| 5   | `forgentic-cache-1.lan`    | Redis Sentinel node 1                                        | `redis-master` (initially), `sentinel-1`, `node-exporter`                                                      |
| 6   | `forgentic-cache-2.lan`    | Redis Sentinel node 2                                        | `redis-replica-1`, `sentinel-2`, `node-exporter`                                                               |
| 7   | `forgentic-cache-3.lan`    | Redis Sentinel node 3                                        | `redis-replica-2`, `sentinel-3`, `node-exporter`                                                               |
| 8   | `metering.lan`             | Lago billing engine (isolated)                               | `lago-api`, `lago-front`, `lago-postgres`, `lago-redis`, `node-exporter`                                       |
| 9   | `observability.lan`        | Telemetry hub for all services (Aquila + Forgentic + future) | `prometheus`, `alertmanager`, `loki`, `tempo`, `grafana`, `cachet`, `cachet-postgres`, `node-exporter`         |

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

| #   | LXC                        | vCPU (min/rec) | RAM (min/rec)     | Disk (min/rec)   | Storage tier            | Start order | Notes                                              |
| --- | -------------------------- | -------------- | ----------------- | ---------------- | ----------------------- | ----------- | -------------------------------------------------- |
| 2   | `forgentic-app.lan`        | 4 / **8**      | 8 GB / **16 GB**  | 40 / **80 GB**   | SSD                     | 30          | Next.js × 3 + Traefik + workers + cloudflared      |
| 3   | `forgentic-db-primary.lan` | 4 / **8**      | 8 GB / **16 GB**  | 100 / **200 GB** | **NVMe**                | 10          | Postgres 16 master, WAL on fast disk               |
| 4   | `forgentic-db-replica.lan` | 4 / **8**      | 8 GB / **16 GB**  | 120 / **240 GB** | **NVMe**                | 11          | Hot standby + nightly pg_dump scratch space        |
| 5   | `forgentic-cache-1.lan`    | 2 / **4**      | 4 GB / **8 GB**   | 20 / **40 GB**   | SSD                     | 20          | Redis master + Sentinel-1                          |
| 6   | `forgentic-cache-2.lan`    | 2 / **4**      | 4 GB / **8 GB**   | 20 / **40 GB**   | SSD                     | 21          | Redis replica-1 + Sentinel-2                       |
| 7   | `forgentic-cache-3.lan`    | 2 / **4**      | 4 GB / **8 GB**   | 20 / **40 GB**   | SSD                     | 22          | Redis replica-2 + Sentinel-3                       |
| 8   | `metering.lan`             | 4 / **6**      | 6 GB / **12 GB**  | 60 / **120 GB**  | SSD                     | 40          | Lago API + Lago Front + Lago Postgres + Lago Redis |
| 9   | `observability.lan`        | 6 / **12**     | 12 GB / **24 GB** | 200 / **500 GB** | SSD (logs >7d → HDD OK) | 50          | Prometheus + Loki + Tempo + Grafana + Cachet       |
|     | **Total recommended**      | **54 vCPU**    | **108 GB**        | **~1.3 TB**      |                         |             |                                                    |

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

| Secret                                               | Used by                                                                    | Rotation                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL_PRIMARY` (writes)                      | `forgentic-app`                                                            | 90d (re-issue Postgres user pw)                                   |
| `DATABASE_URL_REPLICA` (reads)                       | `forgentic-app`                                                            | 90d                                                               |
| `POSTGRES_REPLICATION_PASSWORD`                      | `forgentic-db-primary`, `forgentic-db-replica`                             | 365d                                                              |
| `REDIS_SENTINEL_PASSWORD`                            | `forgentic-app`, all `forgentic-cache-*`                                   | 90d                                                               |
| `AQUILA_BASE_URL`, `AQUILA_SERVICE_ACCOUNT_TOKEN`    | `forgentic-app`                                                            | 90d (Aquila admin token; used only for `POST /orgs` provisioning) |
| `BETTER_AUTH_SECRET`                                 | `forgentic-app`                                                            | 365d (rotation invalidates all sessions — coordinate with users)  |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`                 | `forgentic-app`                                                            | 365d                                                              |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET` | `forgentic-app` (webhooks worker)                                          | 365d                                                              |
| `LAGO_API_KEY`                                       | `forgentic-app` (usage-aggregator), `metering.lan`                         | 90d                                                               |
| `RESEND_API_KEY`                                     | `forgentic-app` (email worker)                                             | 90d                                                               |
| `KMS_ROOT_KEY`                                       | `forgentic-app` (envelope encryption)                                      | 365d (re-encrypt cycle)                                           |
| `CLOUDFLARE_TUNNEL_TOKEN`                            | `forgentic-app` (`cloudflared`)                                            | as-needed (CF dashboard)                                          |
| `BACKBLAZE_B2_KEY_ID`, `BACKBLAZE_B2_APP_KEY`        | `forgentic-db-primary` (WAL archive), `forgentic-db-replica` (dump backup) | 365d                                                              |
| `TURNSTILE_SECRET`                                   | `forgentic-app` (signup endpoint)                                          | as-needed                                                         |
| `GRAFANA_ADMIN_PASSWORD`, `LAGO_FRONT_AUTH`          | `observability.lan`, `metering.lan`                                        | 90d                                                               |
| `TAILSCALE_AUTH_KEY`                                 | every LXC joining tailnet                                                  | 90d                                                               |

**Naming convention rule (from `Aquila/tasks/lessons.md` entry "Cero hardcoding"):** no IPs, hostnames, model names, providers, plan names hardcoded. Every value comes from env. Bootstrap exceptions same as Aquila: `INFISICAL_DOMAIN`, `INFISICAL_PROJECT_ID`, `INFISICAL_CLIENT_ID` (public identifiers needed before first auth).

### M.5 Deploy pipeline

- **GitHub Actions** on push to `main`: typecheck → lint → unit tests → integration tests (with Testcontainers spinning up Postgres + Redis) → Playwright E2E smoke against ephemeral env → build Docker images → push to GHCR.
- **`deploy-forgentic.sh`** (run on `forgentic-app.lan`): pulls latest images for all containers in this LXC → runs Drizzle migrations against primary (auto-rollback marker if any migration fails) → rolling restart of `web-1/2/3` (one at a time, 30s grace each) → verify `/api/health` on all three before marking deploy complete.
- **DB migrations are forward-only**; rollback strategy = restore from PITR (≤1s precision via WAL) or run a forward-fix migration.
- **Per-LXC deploy scripts:** each of LXC 3-9 has its own minimal `deploy.sh` for routine updates (Lago version bump, Grafana plugin, etc.). All wired to GitHub Actions for repeatability.
- **Blue/green for major upgrades:** `forgentic-app.lan` runs two compose stacks side-by-side (`forgentic-app-blue`, `forgentic-app-green`); Traefik routes traffic to the active color; switch is instant + rollback in 5s.

### M.6 Disaster recovery

| Failure scenario                  | Detection                                                           | Recovery action                                                                                                                              | RPO                                                            | RTO                                                                            |
| --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Primary Postgres LXC down         | Patroni health check (v1.5) or manual via Grafana alert (v1)        | Promote replica → update PgBouncer config                                                                                                    | ≤ 1s (sync tables) / ≤ 30s (async tables)                      | 5 min (manual v1) / 30s (auto v1.5)                                            |
| Replica Postgres LXC down         | Grafana alert (replication lag spike)                               | Re-bootstrap replica from primary base backup; backups continue from primary temporarily                                                     | 0 (primary unaffected)                                         | 30 min (replica rebuild)                                                       |
| Redis master + 1 replica down     | Sentinel quorum decides                                             | Promote remaining replica; re-bootstrap others                                                                                               | ≤ 1s (AOF)                                                     | 30s                                                                            |
| `forgentic-app.lan` LXC crash     | Cloudflare Tunnel disconnects → CF returns 530 → Grafana alert      | Restart LXC from snapshot; Tunnel auto-reconnects on boot                                                                                    | 0 (stateless)                                                  | 5 min                                                                          |
| `metering.lan` LXC crash          | Grafana alert (Lago events queue backing up in `forgentic-app.lan`) | Restart Lago LXC from snapshot; re-process queued events from Forgentic                                                                      | 0 (events buffered in BullMQ + Synterra `usage_events` ledger) | 15 min                                                                         |
| `observability.lan` LXC crash     | External uptime monitor (`status.forgentic.io` self-check)          | Restart LXC from snapshot; Promtail/grafana-agent re-buffer until back                                                                       | up to 5 min of telemetry data                                  | 15 min                                                                         |
| Whole Proxmox host down           | External uptime monitor pages on-call                               | Manual recovery: B2 restore to spare host (target: documented in `docs/RUNBOOKS/full-restore.md`); Cloudflare Tunnel re-points to new origin | ≤ 5 min (last WAL archive)                                     | 4 hours (target for v1; reduce to 30 min when Proxmox cluster arrives in v1.5) |
| Cloudflare outage (rare but real) | External monitor + user complaints                                  | Public status page acknowledges; no recovery action — wait for CF                                                                            | 0                                                              | dependent on CF                                                                |

**Backup test cadence:** quarterly drill — restore latest B2 backup to a staging Proxmox host, validate Synterra app comes up clean, log result in `docs/RUNBOOKS/restore-drill-log.md`.

**Snapshot strategy:** Proxmox snapshots of every LXC nightly + before every deploy. 7 daily + 4 weekly + 12 monthly retention.

### M.7 Future capacity expansion

When (not if) we outgrow single-host:

- **v1.5:** Proxmox cluster (3 hosts), enables LXC live-migration + true HA. Each LXC's primary lives on host A, replica on host B, observability on host C. Single-host failure no longer takes us down.
- **v2:** introduce **vertical "Aquila siblings"** as standalone LXCs (e.g. `image-gen.lan`, `voice.lan`, `social-publish.lan`). Each registers itself with `forgentic-app` as a **Capability Provider** via a small registration API — Forgentic discovers them, gates access via plan/quota, attributes usage events back to the right workspace. Lago + observability LXCs absorb their telemetry without code changes.
- **v2.5:** if a single workspace's data exceeds shared-DB limits, flip its `db_routing_key` and provision a dedicated Postgres LXC for it (the hybrid-tenancy escape hatch from Section B.1). The routing layer in `forgentic-app` reads `db_routing_key` and selects the right DB connection.

This "control plane + N data planes + shared metering + shared observability" is the architectural blueprint that lets Forgentic ship features at agency-tier velocity without re-architecting infra each time.

---
