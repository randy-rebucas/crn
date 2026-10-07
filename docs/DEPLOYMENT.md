# Deployment

Production layout:

| Piece | Host | Source |
| --- | --- | --- |
| API (NestJS + Prisma) | Render **Web Service** | `apps/api` |
| Database (PostgreSQL 16) | Render **PostgreSQL** | `apps/api/prisma` |
| Web (Next.js 16) | Vercel | `apps/web` |

Redis from `docker-compose.yml` is local-dev only — no code path uses it yet, so production
doesn't need one.

Deploy in this order, because each side needs the other's URL:

1. Render Postgres
2. Render API (with a placeholder `WEB_ORIGIN`)
3. Vercel web (pointing at the API URL)
4. Back on Render: set `WEB_ORIGIN` to the real web URL and redeploy

---

## Prerequisites

- **Node 24.** Seeding uses `node --experimental-strip-types`, which needs Node ≥ 22.6; the repo is
  developed on 24. Pin it on both hosts (shown below).
- **npm workspaces only.** The root `package-lock.json` is the one and only lockfile. Install from
  the root with `--workspace`, not inside an app directory. Don't commit a `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, or per-app `package-lock.json`: hosts pick their package manager from
  whichever lockfile they find, and a mixed setup breaks the Vercel build (see
  [Troubleshooting](#troubleshooting)).
- Generate two separate JWT secrets:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

---

## 1. Database — Render PostgreSQL

1. Render dashboard → **New → PostgreSQL**.
2. Name `obias-db`, PostgreSQL **16**, same region you'll use for the API.
3. After it's created, copy the **Internal Database URL**. The API uses it — it stays on Render's
   private network and needs no SSL settings.
4. Keep the **External Database URL** for running migrations/seed from your machine if you need
   to. Append `?sslmode=require` when using it.

---

## 2. API — Render Web Service

Render dashboard → **New → Web Service** → connect the GitHub repo.

| Setting | Value |
| --- | --- |
| Root Directory | *(leave empty — repo root)* |
| Runtime | Node |
| Build Command | `npm ci --workspace apps/api --include=dev && npm run prisma:generate --workspace apps/api && npm run build:api` |
| Pre-Deploy Command | `npm exec --workspace apps/api -- prisma migrate deploy` |
| Start Command | `npm run start:prod --workspace apps/api` |
| Health Check Path | `/` |

Why these commands:

- `--include=dev` — `nest build` needs `@nestjs/cli` and `typescript`, which are devDependencies.
  With `NODE_ENV=production` set, a plain `npm ci` skips them and the build fails.
- `prisma:generate` runs explicitly so the build never depends on Prisma's postinstall hook.
- `prisma migrate deploy` applies the committed migrations in `apps/api/prisma/migrations`. It
  never creates new migrations or resets data. **Never** run `prisma migrate dev` against
  production.
- `--workspace apps/api` runs scripts with `apps/api` as the working directory, so `node dist/main`
  resolves and uploads land in `apps/api/uploads`.

> **Free instance type:** Pre-Deploy Commands are only available on paid instances. On the free
> tier, append the migration to the build instead:
> `... && npm run build:api && npm exec --workspace apps/api -- prisma migrate deploy`

### Environment variables

| Variable | Value | Notes |
| --- | --- | --- |
| `NODE_VERSION` | `24` | Pins Render's Node version |
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | Internal Database URL from step 1 | |
| `JWT_ACCESS_SECRET` | random secret | Required — the API throws on first auth request without it |
| `JWT_REFRESH_SECRET` | a **different** random secret | |
| `JWT_ACCESS_TTL` | `15m` | Optional, defaults to `15m` |
| `JWT_REFRESH_TTL` | `7d` | Optional, defaults to `7d` |
| `WEB_ORIGIN` | `https://<your-web-domain>` | CORS allow-origin. Exact match, no trailing slash, one origin only. Use a placeholder until step 3 is done |
| `TRUST_PROXY` | `1` | Render sits in front of the service; without this every visitor shares one rate-limit bucket (100 req/min). See below |
| `PORT` | *(don't set)* | Render injects it; `main.ts` reads it |

**`TRUST_PROXY`:** start with `1`. After deploying, confirm that rate limiting keys on real client
IPs (e.g. two different networks don't share a throttle bucket). If they still collide, Render is
adding more than one hop — raise the count. Avoid `true`: it trusts every `X-Forwarded-For` entry,
which lets a client spoof its IP and dodge the throttle.

### File uploads (requirement submissions)

Uploaded requirement files are written to local disk at `apps/api/uploads/requirements`
(`apps/api/src/modules/requirements/file-storage.ts`). Render's filesystem is **ephemeral** — it
is wiped on every deploy and restart.

To keep uploads, attach a **Persistent Disk** (paid instances only):

| Setting | Value |
| --- | --- |
| Mount Path | `/opt/render/project/src/apps/api/uploads` |
| Size | 1 GB is plenty to start |

A disk pins the service to **one instance** (no horizontal scaling, and deploys have a few seconds
of downtime). Moving uploads to object storage (S3, R2, GCS) removes both limits and is the
long-term fix.

### Verify

```bash
curl https://<api>.onrender.com/            # → Hello World!
curl https://<api>.onrender.com/v1/public/programs
```

---

## 3. Seed the production database (first deploy only)

`prisma/seed.ts` creates system roles, permissions, an organization, branches, **and a demo user
for every role** (all sharing one password). Review it before running against production — you
likely want the roles/permissions and a Super Admin, and should disable or delete the other demo
accounts afterward.

Run it once, from either:

- **Render Shell** (paid instances): service → **Shell**:

  ```bash
  cd apps/api && SEED_ADMIN_PASSWORD='<strong password>' npm run prisma:seed
  ```

- **Your machine**, against the External Database URL:

  ```bash
  cd apps/api
  DATABASE_URL='<external url>?sslmode=require' SEED_ADMIN_PASSWORD='<strong password>' npm run prisma:seed
  ```

Without `SEED_ADMIN_PASSWORD`, the seed generates a random password and prints it **once** — copy
it from the output. Don't leave `SEED_ADMIN_PASSWORD` set as a permanent service env var.

The seed is idempotent; re-running it after adding new permission keys backfills them onto the
system roles.

---

## 4. Web — Vercel

Vercel → **Add New → Project** → import the GitHub repo.

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Node.js Version (Settings → Build and Deployment) | 24.x |
| Include files outside the root directory | Enabled (default) |

Leave Install / Build Command **un-overridden** in the dashboard. They come from
[`apps/web/vercel.json`](../apps/web/vercel.json), which installs from the repo root with npm
(`cd ../.. && npm ci --workspace apps/web`) and builds with `npm run build`. A dashboard override
takes precedence over that file, so clear any old override. `next.config.ts` already sets the
Turbopack root to the repo root so hoisted `node_modules` resolve.

### Environment variables

Set these for **Production** (and **Preview** if you use previews — see below):

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<api>.onrender.com` | No trailing slash. Used by the browser **and** by server-side ISR fetches |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-web-domain>` | Canonical / Open Graph URLs, `sitemap.xml`, `robots.txt` |

`NEXT_PUBLIC_*` values are inlined at **build time**. Changing them takes a **redeploy**, not just
a save.

### Build-time behaviour

Marketing pages are ISR (`revalidate: 60`) and fetch `/v1/public/*` from the API. If the API is
unreachable during `next build`, list pages build empty and fill in on the first revalidation —
the build doesn't fail. Deploying the API first avoids that briefly-empty window.

### Custom domain

Vercel → Project → **Settings → Domains**. After adding it, update:

- Vercel `NEXT_PUBLIC_SITE_URL` → the custom domain, then redeploy.
- Render `WEB_ORIGIN` → the custom domain, then redeploy the API.

---

## 5. Close the loop

Back in Render, set `WEB_ORIGIN` to the final web origin (custom domain, or
`https://<project>.vercel.app`) and redeploy. Then in a browser:

1. Open the site; marketing pages show programs/schedules from the API.
2. Log in as the seeded Super Admin; you land on `/dashboard`.
3. DevTools → Network: API calls return 2xx, with no CORS errors.

---

## Gotchas

- **CORS and preview deployments.** `WEB_ORIGIN` accepts one exact origin. Vercel preview URLs
  (`<project>-git-<branch>-<team>.vercel.app`) won't pass CORS against the production API, so
  logged-in pages break on previews. Public marketing pages still render because their fetches run
  server-side, where CORS doesn't apply. To support previews, point Preview's
  `NEXT_PUBLIC_API_URL` at a separate staging API, or extend `main.ts` to accept a list or pattern
  of origins.
- **No cookies involved.** The access token is sent as a `Bearer` header, and the refresh token
  lives in browser storage, so there's no cross-site cookie / `SameSite` configuration to get right
  between `vercel.app` and `onrender.com`.
- **Free-tier cold starts.** A free Render web service sleeps after ~15 minutes idle; the first
  request then takes ~30–60 s. That can time out ISR revalidations and makes first login slow. Use
  a paid instance for anything real.
- **Free Render Postgres expires** after a limited period. Use a paid plan for production data.
- **Request size limit.** The API caps JSON/urlencoded bodies at 1 MB and uploads at 10 MB, so no
  proxy tuning is needed on Render.

---

## Troubleshooting

### Vercel: `npm error code ENOWORKSPACES` / `Command "pnpm run build" exited with 1`

Vercel detected pnpm (from a `pnpm-lock.yaml`) and built with it. During `next build`, Next finds
a `package-lock.json` and runs its lockfile-patching step, which shells out to
`pnpm config get registry`. pnpm delegates `config` to npm, and npm refuses `config` inside a
workspace. Next only adds the `--no-workspaces` flag that avoids this when it believes the package
manager is npm.

Fix: make sure no `pnpm-lock.yaml` / `pnpm-workspace.yaml` is committed, that
`apps/web/vercel.json` is present, and that the dashboard has no Install/Build Command override.
The build log should then show `npm ci` and `npm run build`.

### Vercel: `Cannot find module '@tailwindcss/oxide-linux-x64-gnu'` (or `lightningcss-linux-x64-gnu`)

Tailwind v4, Lightning CSS and Next's SWC compiler ship native binaries as per-platform optional
packages. When `package-lock.json` is generated on Windows, npm records only the Windows packages
([npm/cli#4828](https://github.com/npm/cli/issues/4828)), so `npm ci` on Vercel's Linux builder has
nothing to install.

`apps/web/package.json` pins the Linux packages under `optionalDependencies` so the lockfile always
records them (Windows/macOS skip installing them):

| Package | Must match |
| --- | --- |
| `@next/swc-linux-x64-gnu` | the `next` version |
| `@tailwindcss/oxide-linux-x64-gnu` | the installed `@tailwindcss/oxide` version |
| `lightningcss-linux-x64-gnu` | the `lightningcss` version under `apps/web/node_modules` |

**When you upgrade `next` or `tailwindcss`, bump these to match,** then run `npm install` from the
repo root. Check the lockfile still has them:
`grep -E 'linux-x64-gnu"' package-lock.json`

## Routine deploys

- Push to `main` → Render and Vercel both auto-deploy (Vercel also builds previews for other
  branches).
- New Prisma migration: create it locally with `npm run prisma:migrate` (from `apps/api`), commit
  the generated folder under `prisma/migrations`, push. The Pre-Deploy Command applies it before the
  new API version goes live.
- Schema changes that the old API can't tolerate (dropped/renamed columns) should ship in two
  steps: deploy code that stops using the column, then a migration that drops it.

### Rollback

- **Vercel:** Deployments → pick the last good one → **Promote to Production** (instant).
- **Render:** Events → pick the last good deploy → **Rollback**. This does **not** undo database
  migrations. If a migration caused the problem, write a forward-fixing migration rather than
  editing an applied one.

---

## Optional: Render Blueprint

To manage the API + database as code, commit this as `render.yaml` at the repo root and create it
via **New → Blueprint**. Secrets marked `sync: false` are prompted for on first creation.

```yaml
databases:
  - name: obias-db
    databaseName: obias
    user: obias
    postgresMajorVersion: "16"
    plan: basic-256mb

services:
  - type: web
    name: obias-api
    runtime: node
    plan: starter
    buildCommand: npm ci --workspace apps/api --include=dev && npm run prisma:generate --workspace apps/api && npm run build:api
    preDeployCommand: npm exec --workspace apps/api -- prisma migrate deploy
    startCommand: npm run start:prod --workspace apps/api
    healthCheckPath: /
    disk:
      name: uploads
      mountPath: /opt/render/project/src/apps/api/uploads
      sizeGB: 1
    envVars:
      - key: NODE_VERSION
        value: "24"
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: obias-db
          property: connectionString
      - key: JWT_ACCESS_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: TRUST_PROXY
        value: "1"
      - key: WEB_ORIGIN
        sync: false
```
