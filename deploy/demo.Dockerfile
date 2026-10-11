# Self-contained demo: the all-in-one app image plus a local Postgres inside the same container.
# Every secret (DB role passwords, JWT and encryption keys) is generated at boot, so nothing has to be
# configured on the host. Data lives in the container and resets on redeploy. Not for production.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates postgresql && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG API_INTERNAL_URL=http://127.0.0.1:4000
ARG NEXT_PUBLIC_WS_URL=
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm --filter @sufra/shared build \
 && pnpm --filter @sufra/api db:generate \
 && pnpm --filter @sufra/api build \
 && NODE_ENV=production pnpm --filter @sufra/web build
ENV NODE_ENV=production
EXPOSE 8080
CMD ["/app/deploy/start-demo.sh"]
