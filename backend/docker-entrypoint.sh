#!/bin/sh
set -e
# migrate deploy only applies already-committed migrations — never
# generates new ones — so it's safe to run unattended on every container
# start.
npx prisma migrate deploy --schema prisma/schema.prisma
# prisma/seed.ts upserts with `update: {}` — an existing SuperAdmin's
# password is never touched, so running this on every container start is
# safe. Skipped entirely when unset, same as running `pnpm db:seed`
# locally without the env var.
if [ -n "$SEED_SUPERADMIN_PASSWORD" ]; then
  npx tsx prisma/seed.ts
fi
exec node dist/main.js
