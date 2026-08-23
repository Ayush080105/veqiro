FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache libc6-compat openssl

# ── builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

# Layer-cache manifests before copying source
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/main/package.json                    ./apps/main/
COPY packages/transactional/package.json       ./packages/transactional/
COPY packages/integrations-catalog/package.json ./packages/integrations-catalog/
RUN pnpm install --frozen-lockfile

COPY apps/main/                     ./apps/main/
COPY packages/transactional/        ./packages/transactional/
COPY packages/integrations-catalog/ ./packages/integrations-catalog/

# integrations-catalog is compiled (unlike transactional's raw source) —
# its package.json main/types point at ./dist/, so it must build first.
RUN pnpm --filter @repo/integrations-catalog build

WORKDIR /repo/apps/main
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ── runner ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3001

COPY --from=builder /repo/apps/main/public              ./apps/main/public
COPY --from=builder /repo/apps/main/.next/standalone    ./
COPY --from=builder /repo/apps/main/.next/static        ./apps/main/.next/static

EXPOSE 3001
CMD ["node", "apps/main/server.js"]
