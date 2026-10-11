#!/bin/sh
# Demo start: boot a private Postgres on 127.0.0.1, create the two roles with fresh random passwords,
# generate the app keys, then hand over to the normal start script.
set -e
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
PGDATA=/var/lib/postgresql/demo
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA" && chown postgres:postgres "$PGDATA"
  su postgres -c "$PGBIN/initdb -D $PGDATA -U postgres --auth-host=scram-sha-256 --auth-local=trust" >/dev/null
fi
mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -c shared_buffers=32MB' -w start" >/dev/null

rnd() { openssl rand -hex 24; }
OWNER_PW=$(rnd)
APP_PW=$(rnd)
sed -e "s/'sufra_owner_dev'/'$OWNER_PW'/" -e "s/'sufra_app_dev'/'$APP_PW'/" /app/infra/db/init.sql > /tmp/init.sql
su postgres -c "psql -q -v ON_ERROR_STOP=1 -f /tmp/init.sql" >/dev/null
su postgres -c "psql -q -c \"ALTER ROLE sufra_owner PASSWORD '$OWNER_PW'\" -c \"ALTER ROLE sufra_app PASSWORD '$APP_PW'\"" >/dev/null
rm -f /tmp/init.sql

export DATABASE_URL="postgresql://sufra_owner:$OWNER_PW@127.0.0.1:5432/sufra"
export DATABASE_URL_APP="postgresql://sufra_app:$APP_PW@127.0.0.1:5432/sufra"
export JWT_ACCESS_SECRET=$(openssl rand -base64 48 | tr -d '\n')
export JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
export DATA_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
export SEED_ON_START=${SEED_ON_START:-if-empty}
exec /app/deploy/start.sh
