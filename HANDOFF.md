# OBIAS Project Handoff

Written for a future Claude Code session (or human) picking this up cold, with
no memory of the conversation that built it. This captures the *why* behind
decisions — the code and `README.md` already cover the *what* and *how to run it*.

## What this is

A production-grade platform for OBIAS Nursing & Allied Courses Review Center:
public site + student portal + staff/instructor tools + admin/management, all
on one NestJS API, one Prisma/PostgreSQL database, one identity/RBAC system.
The full architectural blueprint (personas, RBAC matrix, ERD, API design,
security model, phased roadmap) was written up first as a design doc before
any code — see the artifact link if it's still accessible, or just trust that
the code below matches it; the doc isn't stored in this repo.

## Build order and current state

Built strictly phase-by-phase, each verified live against a running dev
server before moving to the next (not just "looks right" — actual curl
round-trips proving the behavior, including negative cases like invalid
state transitions returning 400).

1. **Foundation** — auth (JWT + refresh rotation, argon2), users, roles,
   permissions, organizations, branches, audit log. Done and tested.
2. **Core Operations** — students, instructors, programs, courses, batches,
   classes, rooms, schedules (with room/instructor conflict detection),
   attendance, enrollment (full status state machine). Done and tested.
3. **Learning** — subject/module/lesson/material content hierarchy with a
   Draft→Review→Approved→Published→Archived pipeline, question bank with the
   same approval pipeline, exam engine (auto-grades objective question types,
   routes essay/image-based to manual grading, attempt limits, result-release
   policy). Done and tested, including a real student account taking a mixed
   auto/manual-graded exam end to end.
4. **Finance** — pricing, invoices (status auto-computed from payments, never
   hand-set), payments with verify/reject and receipt generation, refunds
   with a real multi-step approval chain (Officer → Manager → Process).
   Done and tested.
5. **Advanced Management (partial)** — notifications (centralized
   `emit()` service other modules call into, not per-module ad hoc logic),
   certificates (issuance gated on completed enrollment, public unauthenticated
   QR verification endpoint), CRM/leads pipeline, reports (enrollment funnel,
   revenue, attendance, exam performance — all as read-layer aggregate
   queries, no new schema). **Not built**: a generic reusable "approval
   workflow" abstraction (each domain has its own hand-rolled state machine
   instead — see "Deliberate non-decisions" below) and PWA/push notification
   polish (that's frontend work, Phase 6 in the original roadmap).

Then a punch-list pass, because five phases of business logic had zero
regression protection:

- **Fixed a real bug**: `InvoicesService.recomputeStatus` only summed
  verified payments, never subtracted processed refunds — a fully refunded
  invoice would still read `PAID`. Fixed by having `RefundsService.process`
  call `recomputeStatus` after subtracting processed-refund totals.
- **Added real scope enforcement**: the permission system always resolved
  `GLOBAL`/`BRANCH`/`SELF`/etc. scopes correctly (`buildEffectivePermissions`
  in `permission.utils.ts` picks the broadest grant), but *nothing read the
  resolved scope* — every query was org-scoped only, regardless of what scope
  was actually granted. Built `common/authz/scope.ts` and wired it into
  Students, Enrollments, and Attendance (the three examples the design doc
  itself names). Verified live: seeded a second branch and a branch-manager
  role, confirmed that account genuinely cannot see the other branch's data.
  **This is not applied everywhere** — see "Known gaps" below.
- **Added 35 unit tests** across 8 files (state machines, exam grading,
  RBAC scope resolution, the new scope filters, the permissions guard, and a
  regression lock on `SAFE_USER_SELECT` — see below). All fast, no DB
  needed. Zero integration/e2e tests exist beyond the original one-file
  Nest scaffold test.

Then frontend work started, going only as far as: role-aware nav (reads
`hasPermission()`, not hardcoded role names), Dashboard, Programs, Students,
Enrollments pages. Login and the API client/auth-context predate this.
**Everything else the API supports has no UI**: Courses, Classes/Schedules/
Attendance, Exams/Question Bank, Finance, Leads, Reports, Roles/Audit admin
screens, and the entire student-facing mobile experience (Home/Learn/Exams/
Schedule/Profile) described in the design brief.

## A security bug worth knowing about (caught twice)

Twice during this build, a service wrote `include: { user: true }` (or
similarly unguarded) on a Prisma query whose result reached an API response.
Prisma's `include` returns every scalar column — including `passwordHash`
and `mfaSecret` — unless narrowed with `select`. Both times this was caught
by manually grepping for the pattern and testing the actual response body,
not by code review alone. Fixed with a shared `SAFE_USER_SELECT` constant in
`common/prisma/safe-selects.ts`, and there's now a test
(`safe-selects.spec.ts`) that locks its field list so a future edit that
widens it fails a test instead of shipping.

**If you add any new query that nests a `User` relation into a response,
grep for `user: true` afterward and check the actual JSON, don't just trust
that Prisma "only returns what you asked for" — it doesn't, by default.**

## Known gaps (not hidden, just not done)

- **Scope enforcement is 3 modules deep, not systemic.** Programs, Courses,
  Exams, Payments, Certificates, etc. are still org-scoped only. If you add
  branch-scoped or self-scoped roles for those resources, the permission
  will resolve correctly but the query won't actually narrow — same bug
  class as the one just fixed, just not fixed everywhere yet.
- **Refund processing still doesn't perfectly reconcile in every case** —
  the core bug (fully-refunded invoice reading PAID) is fixed, but the
  `Payment` model has no `REFUNDED` status; a verified-then-refunded payment
  stays `VERIFIED` forever, and `recomputeStatus` compensates by separately
  summing processed refunds each time it runs rather than that being
  reflected on the payment record itself. Works, but a real accounting audit
  would probably want a payment-level refunded flag, not just an invoice-level
  derived recomputation.
- **`DELAYED` exam result release** only distinguishes "graded or not" — for
  an all-objective exam that grades instantly at submit, delayed and
  immediate release behave identically. A real delayed-release policy needs
  an explicit release gate (date or instructor action) that doesn't exist.
- **No integration/e2e tests.** The 35 tests are unit tests on pure logic
  (state machines, grading, scope resolution). Nothing spins up a test
  database and exercises a controller end-to-end. Everything phase-by-phase
  was verified by hand via curl during the build — that verification doesn't
  persist as a regression suite.
- **Frontend has done zero interactive browser testing.** Every frontend
  claim in this repo's history was verified via `tsc --noEmit`, `eslint`,
  and an HTTP smoke test confirming pages return 200 — not by actually
  clicking through a form submission in a browser.

## Deliberate non-decisions (don't "fix" these without reading why first)

- **No generic "ApprovalWorkflow" abstraction.** Enrollment, Refund, Lead,
  and content-status (Module/Lesson/Material/Question) each have their own
  small `Record<Status, Status[]>` transition map and a service method that
  checks it. This was a conscious choice over building one generic workflow
  engine — the four state machines have different shapes (some branch to a
  terminal rejected/cancelled state from multiple points, some don't), and a
  premature generic abstraction would have added indirection without
  removing real duplication. If a fifth or sixth workflow shows up with the
  same shape, that's the signal to extract a shared helper, not before.
- **Modular monolith, not microservices.** Explicit call in the original
  design doc's "do not" list, restated here because it's the kind of thing
  a fresh session might "helpfully" suggest splitting. Don't, unless the
  business reason changes.
- **Prisma client generation on Windows intermittently fails with
  `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`**
  whenever the `nest start --watch` dev process is running (it holds a file
  lock on the engine binary). Fix each time: kill the process on port 3001,
  then `npx prisma generate`, then restart `npm run dev:api`. This isn't a
  bug in the code, just a Windows file-locking quirk with Prisma's watch
  mode — don't spend time trying to architect around it.

## Practical environment notes

- API on `:3001`, web on `:3000`, Postgres on `:55432` (not default 5432),
  Redis on `:6379`, all via `docker-compose up -d postgres redis` from the
  repo root.
- Seed (`npm run prisma:seed` from `apps/api`) creates: `admin@obias.local`
  (super_admin, GLOBAL scope everything), a `student` system role, a
  `branch_manager` system role (BRANCH scope), a second "North Branch", and
  a `north.manager@obias.local` account for testing branch scope live. All
  passwords `ChangeMe123!` for the seeded accounts.
- The seed script is idempotent and additive — re-running it after adding a
  new permission key backfills that permission onto `super_admin` (and onto
  `student`/`branch_manager` if you add their keys to those lists too). It
  does **not** retroactively grant new permissions to custom roles created
  through the app — only to the three seeded system roles.
- Root of the repo is not a git repository. Only `apps/web` has its own
  `.git`. If you want version control at the project level, that's a
  decision for whoever's driving, not something to do unprompted.

## If you're a fresh session reading this

Start by reading `apps/api/prisma/schema.prisma` top to bottom — it's
organized in the same phase order as this document and is the single most
information-dense file in the repo. Then skim `apps/api/src/app.module.ts`
for the module list. Then ask the person what they actually want next rather
than guessing — the natural next steps (in roughly descending value) are:
finishing scope enforcement across all modules, integration tests, or the
remaining frontend screens, but which one matters depends on what this is
actually being used for.
