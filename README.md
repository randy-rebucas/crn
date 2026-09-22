# Obias

OBIAS Nursing & Allied Courses Review Center — a review-center/LMS platform for managing
admissions, enrollment, classes, learning content, exams, finance, and reporting under a single
identity + RBAC system. See [`obias.md`](obias.md) for the full product/architecture brief and
[`HANDOFF.md`](HANDOFF.md) for build history, known gaps, and decisions worth knowing before
changing things.

Monorepo with a Next.js web app and a NestJS API, managed as npm workspaces.

## Structure

- `apps/web` — Next.js 16 frontend (React 19, TypeScript, Tailwind CSS 4, TanStack Query, React
  Hook Form + Zod, Axios). Three role-aware route groups: `(dashboard)` (admin/staff sidebar),
  `(instructor)` (instructor top bar), `(student)` (mobile bottom-tab shell).
- `apps/api` — NestJS 12 API (TypeScript, Prisma 6, PostgreSQL, JWT auth via Passport with
  refresh-token rotation, argon2 password hashing). Organized as one domain module per bounded
  context — see [API modules](#api-modules) below.
- `packages/*` — reserved for shared packages (npm workspace glob is configured; nothing lives
  here yet).

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, React Hook Form, Zod, Axios |
| Backend | NestJS 12, TypeScript, Prisma 6, Passport (JWT), argon2, class-validator |
| Database | PostgreSQL 16 (via Docker, port `55432`) |
| Cache/session infra | Redis 7 (via Docker, port `6379`) |
| Testing | Vitest (API unit + e2e), ESLint (web), oxlint (API) |

## Prerequisites

- Node.js
- Docker (for local Postgres and Redis)

## Getting started

Install dependencies from the repo root (installs both workspaces):

```bash
npm install
```

Start local infrastructure (Postgres and Redis):

```bash
npm run db:up
```

Set up the database (from `apps/api`, first time only):

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Run the API in watch mode:

```bash
npm run dev:api
```

Run the web app in dev mode:

```bash
npm run dev:web
```

The API listens on `http://localhost:3001`, the web app on `http://localhost:3000`.

Stop local infrastructure:

```bash
npm run db:down
```

## Environment variables

`apps/api/.env` (already present for local dev; rotate the secrets before deploying anywhere shared):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (`postgresql://obias:obias_dev_password@localhost:55432/obias?schema=public` for the Docker Compose setup) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for access/refresh tokens |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Token lifetimes (`15m` / `7d` by default) |
| `PORT` | API port (`3001`) |

`apps/web` reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`) and
`NEXT_PUBLIC_USE_MOCKS` — see [Demo login](#demo-login) below.

## Demo login

There are two independent ways to sign in locally, depending on whether you're running against
the real API or just the frontend.

### Real API (recommended once `apps/api` is running)

After `npm run prisma:seed` (from `apps/api`), two accounts exist in the database:

| Role | Email | Password | Scope |
| --- | --- | --- | --- |
| Super Admin | `admin@obias.local` | `ChangeMe123!` | Global — every permission, both branches |
| Branch Manager | `north.manager@obias.local` | `ChangeMe123!` | Branch-scoped to the seeded "North Branch" (proves scoped RBAC actually narrows queries, not just resolves permissions) |

The seed is idempotent and additive: re-running it after adding a new permission key backfills
that permission onto the `super_admin`, `student`, and `branch_manager` system roles, but it will
**not** retroactively grant new permissions to custom roles created through the app.

These are local-development credentials only — change or remove them before deploying to a
shared or production environment.

### Frontend-only mocks (no API required)

`apps/web` can also mock auth entirely in the browser, useful for UI/permission work without a
running backend. It's controlled by `NEXT_PUBLIC_USE_MOCKS` (see
[`apps/web/src/lib/mock-auth.ts`](apps/web/src/lib/mock-auth.ts)):

- `NEXT_PUBLIC_USE_MOCKS=false` (or the real API is reachable) — real `/v1/auth/*` calls hit `apps/api`.
- Anything else (including unset) — auth/session calls are served locally from
  [`apps/web/src/lib/demo-users.ts`](apps/web/src/lib/demo-users.ts), a set of seeded demo users
  covering every role in the RBAC model. All other API calls still go to the real backend.

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

The login page has one-click buttons for each of these. After login, each role lands in the route
group that fits it: Student → `/student`, Instructor → `/instructor`, everyone else → `/dashboard`
(see `landingRouteForUser` in [`auth-context.tsx`](apps/web/src/lib/auth-context.tsx)).

## API modules

`apps/api/src/modules/*`, one directory per bounded context, wired up in
[`app.module.ts`](apps/api/src/app.module.ts):

`auth` · `users` · `roles` · `permissions` · `organizations` · `branches` · `programs` ·
`courses` · `students` · `instructors` · `enrollments` · `batches` · `rooms` · `classes` ·
`schedules` · `attendance` · `subjects` · `curriculum` (lessons/materials) · `questions` ·
`exams` · `attempts` (exam-taking + grading) · `pricing` · `invoices` · `payments` · `refunds` ·
`notifications` · `certificates` · `leads` · `reports`

Shared cross-cutting code lives in `apps/api/src/common`: JWT/permissions guards, the
`@CurrentUser`/`@Permissions` decorators, scope-narrowing helpers (`common/authz/scope.ts`), and
`SAFE_USER_SELECT` (a Prisma `select` allowlist that keeps `passwordHash`/`mfaSecret` out of API
responses — see `HANDOFF.md` for why this exists as an explicit, tested constant).

## API scripts

Run these from `apps/api`:

- `npm run start:dev` — run the API in watch mode (same as `npm run dev:api` from the root)
- `npm run build` — compile with `nest build`
- `npm run start:prod` — run the compiled build (`node dist/main`)
- `npm run prisma:generate` — generate the Prisma client
- `npm run prisma:migrate` — run database migrations in dev
- `npm run prisma:seed` — seed the database (see [Demo login](#demo-login))
- `npm test` — run unit tests with Vitest
- `npm run test:e2e` — run end-to-end tests with Vitest
- `npm run test:cov` — run unit tests with coverage
- `npm run lint` — lint with oxlint

## Web scripts

Run these from `apps/web`:

- `npm run dev` — run the dev server (same as `npm run dev:web` from the root)
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — lint with ESLint

## Root scripts

- `npm run dev:web` — run the web app in dev mode
- `npm run dev:api` — run the API in watch mode
- `npm run db:up` — start Postgres + Redis via Docker Compose
- `npm run db:down` — stop Postgres + Redis
