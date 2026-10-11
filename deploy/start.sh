#!/bin/sh
# All-in-one start: migrate, optionally seed the demo data, then run API + web behind one port.
set -e
cd /app/apps/api
npx prisma migrate deploy
if [ "$SEED_ON_START" = "true" ]; then npx ts-node --transpile-only prisma/seed.ts; fi
API_PORT=4000 NODE_ENV=production node dist/main.js &
cd /app/apps/web
PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production npx next start -p 3000 -H 127.0.0.1 &
exec node /app/deploy/proxy.mjs
