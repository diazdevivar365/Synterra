# syntax=docker/dockerfile:1
# Forgentic workers — BullMQ worker production image
# Build context: Synterra/ root

FROM node:22.22.2-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/db/package.json ./packages/db/
COPY packages/aquila-client/package.json ./packages/aquila-client/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/shared/package.json ./packages/shared/
COPY packages/emails/package.json ./packages/emails/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/workers/node_modules ./apps/workers/node_modules
COPY --from=deps /app/packages/emails/node_modules ./packages/emails/node_modules
COPY . .

ENV NODE_ENV=production
RUN pnpm --filter='@synterra/workers' build

FROM node:22.22.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HEALTH_PORT=3002
# react and @react-email/* live in packages/emails/node_modules (pnpm isolated linker).
# NODE_PATH lets Node.js resolve them when the workers bundle requires them at runtime.
ENV NODE_PATH=/app/packages/emails/node_modules

RUN addgroup --system --gid 1001 forgentic && \
    adduser --system --uid 1001 --ingroup forgentic forgentic

# Keep monorepo path so Node walks up and finds apps/workers/node_modules
COPY --from=builder --chown=forgentic:forgentic /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder --chown=forgentic:forgentic /app/apps/workers/package.json ./apps/workers/package.json
COPY --from=deps --chown=forgentic:forgentic /app/node_modules ./node_modules
COPY --from=deps --chown=forgentic:forgentic /app/apps/workers/node_modules ./apps/workers/node_modules
COPY --from=deps --chown=forgentic:forgentic /app/packages/emails/node_modules ./packages/emails/node_modules

USER forgentic
EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/health | grep -q ok

CMD ["node", "apps/workers/dist/index.mjs"]
