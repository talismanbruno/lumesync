# ============================================================
# Lume — Multi-stage Docker build
# ============================================================

# Stage 1: Install dependencies and build frontend
FROM node:20-slim AS builder

# Tie the frontend build cache to the exact reviewed source revision. Source
# COPY checks should already invalidate naturally, but this makes a stale web
# bundle impossible when a remote BuildKit cache is reused across releases.
ARG BACKSPACE_COMMIT=""

RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY scripts/check-node.mjs scripts/

# Copy package.json files for all workspace packages
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

# Copy patches (referenced by pnpm-lock.yaml)
COPY patches/ patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code (excluding desktop — not needed in Docker)
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY packages/web/ packages/web/

# Build the web frontend
RUN echo "Building Lume web at ${BACKSPACE_COMMIT}" && pnpm --filter @backspace/web build

# ============================================================
# Stage 2: Production runtime
FROM node:20-slim AS runtime

RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

# Runtime deps only: ffmpeg (media processing) + gosu (drop to non-root in the
# entrypoint). No C toolchain — better-sqlite3 and sharp load prebuilt binaries.
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends ffmpeg gosu tar && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY scripts/check-node.mjs scripts/

# Copy package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

# Copy patches (referenced by pnpm-lock.yaml)
COPY patches/ patches/

# Install only the server's production dependency graph. The web application is
# already compiled in the builder stage, so shipping its runtime dependencies
# only increases the image size and attack surface.
RUN pnpm install --prod --frozen-lockfile --filter @backspace/server...

# npm/corepack are build-time package managers and are not used by the running
# service. Remove them (and their bundled dependency trees) from the final image
# after pnpm has materialized the server dependencies.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /root/.cache/node/corepack && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Copy shared source (needed at runtime since server imports types directly)
COPY packages/shared/ packages/shared/

# Copy server source
COPY packages/server/ packages/server/

# Copy built frontend from builder stage
COPY --from=builder /app/packages/web/dist packages/web/dist

# Create data directories
RUN mkdir -p /app/data/uploads

# Non-root hardening: copy the privilege-dropping entrypoint. It chowns the
# data volume as root, then execs the CMD as the unprivileged `node` user.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/backspace.db
ENV UPLOAD_DIR=/app/data/uploads

# AGPL-3.0 § 13 source offer: bake the running build's git commit into the image
# so GET /api/instance/info can advertise the exact version. Passed via
# --build-arg BACKSPACE_COMMIT=$(git rev-parse --short HEAD) (see deploy.sh /
# docker-compose.yml). Empty when git is unavailable → server treats as null.
ARG BACKSPACE_COMMIT=""
ENV BACKSPACE_COMMIT=$BACKSPACE_COMMIT

EXPOSE 3000

# Health check — reads PORT from environment so it works with any configured port
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Run the server using tsx from the server package directory
WORKDIR /app/packages/server
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
