#!/bin/sh
set -e
# migrate deploy only applies already-committed migrations — never
# generates new ones — so it's safe to run unattended on every container
# start.
npx prisma migrate deploy --schema prisma/schema.prisma
exec node dist/main.js
