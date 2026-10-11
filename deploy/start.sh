#!/bin/sh
# All-in-one start: migrate, optionally seed the demo data, then run API + web behind one port.
set -e
cd /app/apps/api
npx prisma migrate deploy
if [ "$SEED_ON_START" = "true" ]; then
  npx ts-node --transpile-only prisma/seed.ts
elif [ "$SEED_ON_START" = "if-empty" ]; then
  # Containers that sleep and wake must keep their data: seed only a fresh database.
  ORGS=$(node -e "const p=new (require('@prisma/client').PrismaClient)();p.organization.count().then(n=>{console.log(n);return p.\$disconnect()})")
  if [ "$ORGS" = "0" ]; then npx ts-node --transpile-only prisma/seed.ts; fi
fi
API_PORT=4000 NODE_ENV=production node dist/main.js &
cd /app/apps/web
PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production npx next start -p 3000 -H 127.0.0.1 &
exec node /app/deploy/proxy.mjs
