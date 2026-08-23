FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache libc6-compat openssl

# ── builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

# Layer-cache manifests before copying source
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install --frozen-lockfile

COPY apps/admin/ ./apps/admin/

WORKDIR /repo/apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ── runner ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3002

COPY --from=builder /repo/apps/admin/.next/standalone ./
COPY --from=builder /repo/apps/admin/.next/static     ./apps/admin/.next/static

EXPOSE 3002
CMD ["node", "apps/admin/server.js"]
