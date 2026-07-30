# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-bookworm-slim AS builder
WORKDIR /app
# cmake + curl added for whisper.cpp: compiled from source (see
# scripts/build-whisper.js) at build time, same as it was compiled once by
# hand on the dev machine — never at runtime, and never via the interactive
# `npx nodejs-whisper download` (fails outside a real TTY, Docker build
# included).
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    python3 make g++ cmake curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN node scripts/build-whisper.js
# Build-time SQLite so Next can prerender pages that query Prisma.
# Runtime uses /data/noticed.db on the Fly volume (see entrypoint).
ENV DATABASE_URL="file:./build.db"
RUN npx prisma generate \
  && npx prisma migrate deploy \
  && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3004
ENV HOSTNAME=0.0.0.0

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /data && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/generated ./src/generated
RUN mkdir -p /app/scripts
COPY --from=builder /app/scripts/seed-brands-runtime.js ./scripts/seed-brands-runtime.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Entrypoint: migrate SQLite on volume, seed brands, then start
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Entrypoint runs as root to chown the volume, then drops to nextjs
USER root
EXPOSE 3004
ENV DATABASE_URL="file:/data/noticed.db"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
