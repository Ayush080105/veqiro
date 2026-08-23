FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apk add --no-cache libc6-compat openssl

# ── builder ────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /repo

# Layer-cache manifests before copying source
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json                  ./apps/server/
COPY packages/transactional/package.json       ./packages/transactional/
COPY packages/integrations-catalog/package.json ./packages/integrations-catalog/
RUN pnpm install --frozen-lockfile

# Copy source (selective — avoids .env and other apps)
COPY apps/server/src/             ./apps/server/src/
COPY apps/server/prisma/          ./apps/server/prisma/
COPY apps/server/tsconfig.json    ./apps/server/tsconfig.json
COPY apps/server/prisma.config.ts ./apps/server/prisma.config.ts
COPY packages/transactional/      ./packages/transactional/
COPY packages/integrations-catalog/ ./packages/integrations-catalog/

# integrations-catalog is compiled (unlike transactional's raw source) —
# its package.json main/types point at ./dist/, so it must build first.
RUN pnpm --filter @repo/integrations-catalog build

# Generate Prisma client then compile TypeScript
# DATABASE_URL only needs to *resolve* here — `prisma generate` never opens a
# connection (unlike `migrate deploy`, which runs for real at container start
# with the actual value). A placeholder keeps the real secret out of the
# build args/logs entirely.
WORKDIR /repo/apps/server
ARG DATABASE_URL=postgresql://user:password@localhost:5432/placeholder
RUN pnpm exec prisma generate
RUN pnpm run build

# pnpm deploy resolves workspace deps into a standalone dir (no symlinks).
# Use rm -rf before each cp to prevent nesting when pnpm deploy already
# included the directory (e.g. prisma/ is not gitignored).
# dist/ is excluded by root .gitignore but copied explicitly here.
WORKDIR /repo
RUN pnpm --filter=server deploy --prod /standalone
RUN rm -rf /standalone/dist /standalone/prisma && \
    cp -r /repo/apps/server/dist   /standalone/dist && \
    cp -r /repo/apps/server/prisma /standalone/prisma

# ── runner ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /standalone .

EXPOSE 5000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node --import tsx/esm dist/src/server.js"]
