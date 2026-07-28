#!/bin/sh
set -eu

mkdir -p /data
chown -R nextjs:nodejs /data 2>/dev/null || true
export DATABASE_URL="${DATABASE_URL:-file:/data/noticed.db}"

# Apply Prisma migrations against the persistent volume DB
su -s /bin/sh nextjs -c "npx prisma migrate deploy"

# Idempotent brand seed (keys must match MCP BRAND_KEYS)
su -s /bin/sh nextjs -c "node /app/scripts/seed-brands-runtime.js"

exec su -s /bin/sh nextjs -c "exec node server.js"
