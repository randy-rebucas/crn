# OBIAS Platform — Demo Presentation Plan

**Audience:** OBIAS owners / management
**Length:** ~30 minutes (25 min demo + Q&A)
**Goal:** Show that one platform runs the whole review-center business — from first inquiry to
certificate — and leave with clear next steps and decisions.

---

## 1. The story

Don't tour screens. Follow **one student's journey from inquiry to certificate**, switching roles
as the student moves through the review center. This makes the platform's breadth feel like one
connected business, and the role switches demonstrate RBAC without having to explain it.

> "Today we'll follow Maria — from the moment she finds OBIAS online to the moment she earns her
> certificate — and see every team that touches her along the way."

---

## 2. Run of show

| # | Time | Segment | Log in as | What to show |
|---|---|---|---|---|
| 1 | 2m | **Hook** | — | Today's pain: spreadsheets, paper enrollment, scattered exams and payments. Promise: *one platform, inquiry to certificate.* |
| 2 | 3m | **Public website** | (logged out) | `/` → `/offerings` → `/programs/nursing-board-review` → `/schedule` → `/contact` (submit an inquiry as Maria). Note it's mobile-first. |
| 3 | 3m | **Lead → Admission** | `admissions_officer@obias.local` | `/leads` (Maria's inquiry appears) → `/admissions` → convert to student |
| 4 | 3m | **Enrollment & Billing** | `registrar@obias.local` → `cashier@obias.local` → `finance_officer@obias.local` | `/enrollments` → `/finance`: show paid / partially paid / overdue invoices. Miguel Ramos has a **pending** ₱7,500 bank transfer: Cashier can record payments but not verify them; Finance Officer verifies it live → receipt issued (separation of duties) |
| 5 | 4m | **Academics** | `academic_director@obias.local` → `operations_manager@obias.local` | Academic Director: `/programs` → `/courses` → `/curriculum` → `/exams` (question bank, 3 published exams). Operations Manager: `/classes` → `/schedules` (Academic Director can't open these) |
| 6 | 3m | **Instructor's day** | `instructor@obias.local` | `/instructor/classes` → take attendance → `/instructor/grading`: Liza's and Miguel's *NCLEX Mock Exam 1* essays (submitted 1–2 days before seeding) are waiting — grade one live. `/instructor/attendance` → Section B → mark today's roll call |
| 7 | 5m | **Student experience** ⭐ | `student@obias.local` (on a phone) | `/student` home → `/student/learn`, `/student/videos` → take the **Med-Surg Practice Quiz** live (10 min, spare attempts) → `/student/progress` (score trend climbs 67% → 50% → 75% → 80%: diagnostic, two practice runs, mock exam) → `/student/certificates` |
| 8 | 2m | **Certificate verification** | (logged out) | `/verify/[token]` (token printed at the end of the seed output) — anyone (employer, PRC) can confirm a certificate is genuine |
| 9 | 3m | **Management view** | `owner_executive@obias.local` → `north.manager@obias.local` | Owner: `/dashboard` → `/reports` (whole organization). Then Branch Manager: `/dashboard` → `/students` → `/enrollments` show **only North Branch** (Angela Cruz, Paolo Villanueva): same screens, narrower scope. Branch Manager has no `/reports` access |
| 10 | 2m | **Control & trust** | `admin@obias.local` | `/roles` / `/permissions` (20 roles, custom roles possible) → `/audit-logs` (who did what, when) |
| 11 | 5m+ | **Wrap & Q&A** | — | Recap the journey, what's next, decisions needed |

⭐ **Highlight moment:** the student portal on a phone. Give it the most time and let the
audience see it up close.

All demo accounts use password `DevPass123!` (see [README → Demo login](../README.md#demo-login)).

---

## 3. Talking points per segment

1. **Hook** — Name 2–3 concrete pains OBIAS has today. Keep it about their business, not the tech.
2. **Public website** — "This is where students find you. Every inquiry lands directly in the system — no lost Facebook messages."
3. **Lead → Admission** — "Admissions sees the inquiry instantly and converts it in a few clicks."
4. **Enrollment & Billing** — "Enrollment and payment are linked — finance always knows who has paid."
5. **Academics** — "Programs, courses, lessons, question banks — content is built once and reused per batch."
6. **Instructor** — "Instructors only see their own classes. Attendance and grading take seconds."
7. **Student** — "Everything a reviewee needs in their pocket: lessons, videos, mock exams, progress."
8. **Verification** — "Certificates can't be faked — anyone can verify them online."
9. **Management** — "Owners see the whole organization; branch managers see only their branch."
10. **Control** — "Every role has exactly the access it needs, and every action is logged."

---

## 4. Preparation checklist

### Day before

- [x] Decide: demo **locally** or on the **deployed** setup (API on Render, web on Vercel — see
      [DEPLOYMENT.md](DEPLOYMENT.md)). If deployed, warm up the API first — Render's free tier
      sleeps and the first request can take 30s+.
- [x] Seed with `SEED_ADMIN_PASSWORD=DevPass123!` (from `apps/api`: `npm run prisma:seed`) so
      every account shares one password. **Copy the `/verify/<token>` URL** printed at the end.
- [x] The seed includes walkthrough data for every segment: `student@obias.local` is a graduate
      of the January 2026 batch with exam history, a paid invoice, a certificate, and
      notifications; the batch's other students give finance and grading something to act on.
- [ ] **Rehearsal uses up the live moments** (the pending payment gets verified, the essays get
      graded). The seed is additive and won't undo them, so demo from a fresh database. To build
      one without touching your dev data (Git Bash, repo root):

      ```bash
      docker compose exec -T postgres psql -U obias -d postgres \
        -c "DROP DATABASE IF EXISTS obias_demo;" -c "CREATE DATABASE obias_demo;"
      cd apps/api
      export DATABASE_URL="$(grep '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"' | sed 's#/obias?#/obias_demo?#')"
      npx prisma migrate deploy
      SEED_ADMIN_PASSWORD='DevPass123!' npm run prisma:seed   # copy the /verify/<token> URL
      npm run start:dev                                        # API now serves obias_demo
      ```

      Re-run the first block right before the demo to reset. Make sure no other API is already
      on port 3001, or the new one fails to start and you end up demoing the dev database.
- [x] Full dry run of the script, end to end (automated browser pass on a clean seed, 2026-10-09).

### Day of

- [ ] One browser profile (or incognito window) per role, already logged in — no logging in and
      out on stage. The script uses 11 accounts: admissions officer, registrar, cashier, finance
      officer, academic director, operations manager, instructor, student, owner, north manager,
      admin. **Login is rate-limited to 5 attempts per minute per IP**, so sign them in over a few
      minutes beforehand, not all at once. Sessions last 7 days.
- [ ] Phone (or responsive mode) ready for the student segment.
- [ ] Cheat sheet with emails and URLs per segment.
- [ ] Browser zoom 125–150%; notifications off; close unrelated tabs.
- [ ] **Backup:** screen recording or screenshots of the full flow in case Wi-Fi or the API fails.

---

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Live data entry is slow / typos on stage | Pre-create most records; do only 1–2 live clicks per segment |
| Exam attempt has a time limit | Use the 4-question Med-Surg Practice Quiz (10 min, 10 attempts allowed) |
| Locked out after several quick logins (5/min limit) | Pre-log in every role; if it happens, wait 60 seconds and talk through the previous screen |
| API cold start or network failure | Warm up beforehand; have the recorded backup ready |
| Unfinished pages | Route around them; don't apologize on stage |
| Questions about features not built yet | Capture them as "next phase" items — turn them into roadmap input |

---

## 6. Closing

End with three things:

1. **What's built** — the full journey they just saw.
2. **What's next** — pilot branch, data migration, training, go-live date.
3. **What we need from you** — specific decisions or sign-off.

---

## 7. Follow-ups after the demo

- [ ] Send a summary and the recording to attendees.
- [ ] Log every question and feature request raised.
- [ ] Confirm agreed next steps and dates.
