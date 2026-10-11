-- Creates the two database roles the platform uses.
-- sufra_owner: owns the schema, runs migrations/seed and the narrow auth lookups (BYPASSRLS).
-- sufra_app:   the runtime role for every tenant request. Subject to Row-Level Security.
-- Passwords here are for local development only; production uses secrets from the vault.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sufra_owner') THEN
    CREATE ROLE sufra_owner LOGIN PASSWORD 'sufra_owner_dev' BYPASSRLS CREATEDB;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sufra_app') THEN
    CREATE ROLE sufra_app LOGIN PASSWORD 'sufra_app_dev' NOBYPASSRLS;
  END IF;
END $$;
SELECT 'CREATE DATABASE sufra OWNER sufra_owner'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sufra')\gexec
\connect sufra
ALTER SCHEMA public OWNER TO sufra_owner;
GRANT USAGE ON SCHEMA public TO sufra_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sufra_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sufra_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sufra_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sufra_app;
