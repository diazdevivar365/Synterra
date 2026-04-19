# syntax=docker/dockerfile:1
# Forgentic web — Next.js 16 standalone production image
# Build context: Synterra/ root (set in lxc-app/docker-compose.yml)

FROM node:22.22.2-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# ── Deps stage ───────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/workers/package.json ./apps/workers/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/billing/package.json ./packages/billing/
COPY packages/aquila-client/package.json ./packages/aquila-client/
COPY packages/ui/package.json ./packages/ui/
COPY packages/emails/package.json ./packages/emails/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/shared/package.json ./packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build shared packages first
RUN pnpm --filter='@synterra/tsconfig' build 2>/dev/null || true
RUN pnpm --filter='@synterra/shared' build 2>/dev/null || true
RUN pnpm --filter='@synterra/ui' build 2>/dev/null || true
RUN pnpm --filter='@synterra/emails' build 2>/dev/null || true

# Build Next.js with standalone output
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter='@synterra/web' build

# ── Runner stage ─────────────────────────────────────────────────────────────
FROM node:22.22.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 forgentic && \
    adduser --system --uid 1001 --ingroup forgentic forgentic

COPY --from=builder --chown=forgentic:forgentic /app/apps/web/.next/standalone ./
COPY --from=builder --chown=forgentic:forgentic /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=forgentic:forgentic /app/apps/web/public ./apps/web/public

USER forgentic
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health | grep -q ok

CMD ["node", "apps/web/server.js"]
