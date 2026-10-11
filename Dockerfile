# Demo deploy: API (NestJS) + web (Next.js) in one container behind a small proxy on $PORT.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
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
CMD ["/app/deploy/start.sh"]
