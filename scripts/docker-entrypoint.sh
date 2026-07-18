#!/bin/sh
set -eu

echo "[entrypoint] Applying Prisma migrations..."
prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] Seeding database..."
  # package.json prisma.seed uses tsx; available globally in the image
  prisma db seed || echo "[entrypoint] Seed skipped or failed (continuing)."
fi

echo "[entrypoint] Starting Next.js on :${PORT:-3000}"
exec node server.js
