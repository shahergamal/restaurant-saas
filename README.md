# سُفرة · Sufra

نظام إدارة مطاعم (SaaS) متعدد الفروع: الطلبات، الطاولات، شاشة المطبخ، المخزون، التقارير، وتكلفة الطعام والربح.
واجهة عربية (RTL) أولاً مع الإنجليزية، الريال السعودي، ضريبة 15%، والتاريخ الهجري بجانب الميلادي.

Restaurant management SaaS: orders, tables, kitchen display, inventory, reports and real food cost. Arabic RTL first, English included.

## Stack
- `apps/web`: Next.js 15 + React 19, Tailwind, React Query, Recharts, Socket.IO client
- `apps/api`: NestJS 11 + Prisma 6, PostgreSQL 16 (row-level security per tenant), Redis
- `packages/shared`: money/VAT math, costing, permissions and validation shared by both (unit-tested)

## Run it locally (Windows, macOS or Linux)
Requirements: Node 20+, pnpm 10 (`npm i -g pnpm`), Docker Desktop.

```bash
git clone https://github.com/shahergamal/restaurant-saas.git
cd restaurant-saas
pnpm install
docker compose up -d                 # PostgreSQL + Redis
```

Create the env files from the example (on Windows PowerShell use `copy` instead of `cp`):
```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```
Then put real random values in `apps/api/.env` for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `DATA_ENCRYPTION_KEY`
(`openssl rand -base64 48` / `openssl rand -base64 32`, or any password generator).

```bash
pnpm --filter @sufra/shared build
pnpm db:migrate
pnpm db:seed                          # Saudi demo data; re-run any time to refresh the live orders
pnpm dev                              # web on http://localhost:3000, API on http://localhost:4000
```

Demo login: `manager@sufra.demo` / `Sufra@Demo2026` (also `owner@`, `cashier@`, `chef@`, `accountant@`, `stock@` with the same password).

## Tests
```bash
pnpm --filter @sufra/shared test     # money, VAT, costing, permissions
pnpm --filter @sufra/api test:e2e    # tenant isolation, RLS, roles, CSRF, token rotation (needs the DB)
```

## Notes
- Brand, logo and illustrations are original; the layout follows the reference screens.
- ZATCA Phase 2 e-invoicing, payment terminals and delivery-app integrations are later phases; invoices are stored as `pending` until then.
- Design tokens and rules: [DESIGN.md](DESIGN.md).
