#!/bin/sh
set -eu

UPLOAD_ROOT="${UPLOAD_DIR:-/app/public/uploads/pages}"
mkdir -p "$UPLOAD_ROOT"

# Named Docker volumes are often root-owned; fix before dropping privileges.
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /app/public/uploads 2>/dev/null || true
  chown -R nextjs:nodejs "$UPLOAD_ROOT" 2>/dev/null || true
  exec runuser -u nextjs -- "$0" "$@"
fi

echo "[entrypoint] Applying Prisma migrations..."
prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ]; then
  if [ "${NODE_ENV:-}" = "production" ]; then
    echo "[entrypoint] Refusing SEED_ON_START in production (demo admin must not be created)."
    echo "[entrypoint] Create the first admin via a controlled process, not prisma seed."
    exit 1
  fi
  echo "[entrypoint] Seeding database..."
  # package.json prisma.seed uses tsx; available globally in the image
  prisma db seed || echo "[entrypoint] Seed skipped or failed (continuing)."
fi

echo "[entrypoint] Starting Next.js on :${PORT:-3000}"
exec node server.js
