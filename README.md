# Obias

Monorepo with a Next.js web app and a NestJS API.

## Structure

- `apps/web` — Next.js 16 frontend (React 19, Tailwind CSS 4, TanStack Query)
- `apps/api` — NestJS API (Prisma 6, PostgreSQL, Redis, JWT auth via Passport)
- `packages/*` — shared packages

## Prerequisites

- Node.js
- Docker (for local Postgres and Redis)

## Getting started

Install dependencies from the repo root:

```bash
npm install
```

Start local infrastructure (Postgres and Redis):

```bash
npm run db:up
```

Run the API in watch mode:

```bash
npm run dev:api
```

Run the web app in dev mode:

```bash
npm run dev:web
```

Stop local infrastructure:

```bash
npm run db:down
```

## Demo login

`apps/api` isn't scaffolded yet, so `npm run prisma:seed` has nothing to run. In the meantime, `apps/web` mocks auth locally with a set of seeded demo users covering each role in the RBAC model — see [`apps/web/src/lib/demo-users.ts`](apps/web/src/lib/demo-users.ts). Password is the same for all of them.

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `superadmin@obias.demo` | `Passw0rd!` |
| Branch Manager | `branchmanager@obias.demo` | `Passw0rd!` |
| Academic Director | `academicdirector@obias.demo` | `Passw0rd!` |
| Instructor | `instructor@obias.demo` | `Passw0rd!` |
| Registrar | `registrar@obias.demo` | `Passw0rd!` |
| Admissions Officer | `admissions@obias.demo` | `Passw0rd!` |
| Finance Manager | `financemanager@obias.demo` | `Passw0rd!` |
| Finance Officer | `financeofficer@obias.demo` | `Passw0rd!` |
| Front Desk Staff | `frontdesk@obias.demo` | `Passw0rd!` |
| Auditor | `auditor@obias.demo` | `Passw0rd!` |
| Student | `student@obias.demo` | `Passw0rd!` |

The login page also has one-click buttons for each of these. These accounts are mocked in the frontend only (set `NEXT_PUBLIC_USE_MOCKS=false` once a real API is available) and are for local development only.

## API scripts

Run these from `apps/api`:

- `npm run prisma:generate` — generate the Prisma client
- `npm run prisma:migrate` — run database migrations in dev
- `npm run prisma:seed` — seed the database
- `npm test` — run tests with Vitest
- `npm run lint` — lint with oxlint

## Web scripts

Run these from `apps/web`:

- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — lint with ESLint
