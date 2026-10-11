# Deploy on Cloudflare Containers

Needs the Workers Paid plan (Containers are not on the free plan).

1. Workers & Pages > Create > Import a repository > `shahergamal/restaurant-saas`.
2. Build settings: root directory `deploy/cloudflare`, deploy command `npx wrangler deploy`, production branch of your choice.
3. Settings > Variables and Secrets, add as **Secrets**:
   `DATABASE_URL` (owner role, Neon direct host, `?sslmode=require`), `DATABASE_URL_APP` (app role, same host),
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY`.
4. Deploy. The first request cold-starts the container, runs migrations and seeds the demo data once
   (`SEED_ON_START=if-empty`), so it can take a minute or two.

Non-secret settings live in `wrangler.jsonc` under `vars`. `WEB_ORIGINS` left empty means the
origin the Worker is served on.
