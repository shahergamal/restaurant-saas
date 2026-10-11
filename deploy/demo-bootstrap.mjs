// Demo-only bootstrap for a platform-provisioned Postgres (e.g. a Railway Postgres service).
// Given a superuser URL in DEMO_SUPERUSER_URL it creates the sufra_owner / sufra_app roles with fresh
// random passwords, keeps the JWT and data-encryption keys in a superuser-only table so they survive
// restarts, and prints shell `export` lines for DATABASE_URL, DATABASE_URL_APP and the keys.
// No secret ever has to be typed into the hosting dashboard. Not for production: the encryption key
// lives in the same database it protects.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/package.json`);
const { PrismaClient } = require('@prisma/client');

const superUrl = process.env.DEMO_SUPERUSER_URL;
if (!superUrl) throw new Error('DEMO_SUPERUSER_URL is not set');

const db = new PrismaClient({ datasourceUrl: superUrl });
const hex = (n) => randomBytes(n).toString('hex');

async function main() {
  const ownerPw = hex(24);
  const appPw = hex(24);
  await db.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sufra_owner') THEN
      CREATE ROLE sufra_owner LOGIN BYPASSRLS CREATEDB;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sufra_app') THEN
      CREATE ROLE sufra_app LOGIN NOBYPASSRLS;
    END IF;
  END $$`);
  await db.$executeRawUnsafe(`ALTER ROLE sufra_owner PASSWORD '${ownerPw}'`);
  await db.$executeRawUnsafe(`ALTER ROLE sufra_app PASSWORD '${appPw}'`);
  await db.$executeRawUnsafe(`ALTER SCHEMA public OWNER TO sufra_owner`);
  await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO sufra_app`);
  await db.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES FOR ROLE sufra_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sufra_app`,
  );
  await db.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES FOR ROLE sufra_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sufra_app`,
  );

  await db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS demo_bootstrap`);
  await db.$executeRawUnsafe(`REVOKE ALL ON SCHEMA demo_bootstrap FROM PUBLIC`);
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS demo_bootstrap.secrets (name text PRIMARY KEY, value text NOT NULL)`,
  );
  const wanted = {
    JWT_ACCESS_SECRET: () => randomBytes(48).toString('base64'),
    JWT_REFRESH_SECRET: () => randomBytes(48).toString('base64'),
    DATA_ENCRYPTION_KEY: () => randomBytes(32).toString('base64'),
  };
  for (const [name, make] of Object.entries(wanted)) {
    await db.$executeRawUnsafe(
      `INSERT INTO demo_bootstrap.secrets (name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      name,
      make(),
    );
  }
  const rows = await db.$queryRawUnsafe(`SELECT name, value FROM demo_bootstrap.secrets`);

  const withUser = (user, pw) => {
    const u = new URL(superUrl);
    u.username = user;
    u.password = pw;
    return u.toString();
  };
  const out = {
    DATABASE_URL: withUser('sufra_owner', ownerPw),
    DATABASE_URL_APP: withUser('sufra_app', appPw),
  };
  for (const r of rows) out[r.name] = r.value;
  for (const [k, v] of Object.entries(out)) process.stdout.write(`export ${k}='${v}'\n`);
}

main()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
