FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache libc6-compat openssl

# ── builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

# Layer-cache manifests before copying source
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/landing/package.json                  ./apps/landing/
COPY packages/integrations-catalog/package.json ./packages/integrations-catalog/
RUN pnpm install --frozen-lockfile

COPY apps/landing/                  ./apps/landing/
COPY packages/integrations-catalog/ ./packages/integrations-catalog/

# integrations-catalog is compiled (unlike transactional's raw source) —
# its package.json main/types point at ./dist/, so it must build first.
RUN pnpm --filter @repo/integrations-catalog build

WORKDIR /repo/apps/landing
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ── runner ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=builder /repo/apps/landing/public           ./apps/landing/public
COPY --from=builder /repo/apps/landing/content          ./apps/landing/content
COPY --from=builder /repo/apps/landing/.next/standalone ./
COPY --from=builder /repo/apps/landing/.next/static     ./apps/landing/.next/static

# blog.ts reads content/blog relative to process.cwd() — cwd must match
# the app's own directory (not /app) for that relative path to resolve.
WORKDIR /app/apps/landing

EXPOSE 3000
CMD ["node", "server.js"]
