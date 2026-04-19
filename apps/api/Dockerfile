# syntax=docker/dockerfile:1
# Forgentic API — Hono/Node production image
# Build context: Synterra/ root

FROM node:22.22.2-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/tsconfig/package.json ./packages/tsconfig/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

ENV NODE_ENV=production
RUN pnpm --filter='@synterra/api' build

FROM node:22.22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 forgentic && \
    adduser --system --uid 1001 --ingroup forgentic forgentic

# tsup bundles all deps — only the dist artifact is needed at runtime
COPY --from=builder --chown=forgentic:forgentic /app/apps/api/dist ./dist

USER forgentic
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/v1/health | grep -q ok

CMD ["node", "dist/index.mjs"]
