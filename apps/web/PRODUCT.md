# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: prospective reviewees (recent nursing/allied-health graduates and licensure-exam
retakers in and around Las Piñas City / Metro Manila) researching and choosing a review center
before their board exam. They are deciding whether to enroll and need to trust the center's track
record fast.

Secondary audiences for the same public site: parents/family helping evaluate the choice, and
partner schools/organizations checking legitimacy before referring students.

This app also serves enrolled students, instructors, and center staff/management through separate
authenticated portals (existing `(student)`, `(instructor)`, `(dashboard)` route groups). The
current task is Experience A only: the public, unauthenticated marketing site that sits in front
of those portals and drives enrollment.

## Product Purpose

OBIAS Nursing & Allied Courses Review Center is a review-center/LMS platform. The public website's
job is to convert visiting prospective reviewees into enrollees (or inquiries) by establishing
credibility (track record, instructors, results) and making programs and next steps easy to find.
Success = enrollment inquiries/applications started from the site.

## Positioning

Confirmed by the user: **pass-rate / track record is the primary claim** — "20+ years of
excellence," a high board-exam passing rate, and thousands of successful reviewees, reinforced by
experienced review instructors and comprehensive materials. This is the center's differentiating
claim versus other review centers, not price or flexibility.

## Operating Context

- Single physical center: Jinyang Bldg. #1, Manila Doctors Access Road, Almanza Uno, Las Piñas
  City. No evidence of multiple branches or online-only delivery; treat delivery mode as
  in-person/on-site unless told otherwise.
- Reviewees typically decide during specific enrollment windows tied to licensure exam schedules
  ("Now Accepting Enrollees!" urgency messaging observed in existing materials).
- Contact channels in active use: phone (multiple mobile numbers), Facebook page, email, and a
  physical walk-in visit (QR code drives to Facebook).

## Capabilities and Constraints

- Review programs offered: Nursing (NLE), Midwifery, Medical Technology, Physical Therapy.
- Additional offerings: Seminar & Training, Caregiving Course, Foreign Language Skills.
- Primary conversion action (confirmed): **Enroll / Apply now** — the site should drive straight
  toward enrollment/application, not just lead capture, though a lower-commitment inquiry/contact
  path should remain available for visitors not ready to commit.
- Built inside an existing Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 monorepo app
  (`apps/web`) that already contains authenticated route groups for dashboard/instructor/student.
  The public site is new route(s) in the same app, unauthenticated, in front of `/login`.
- No online/remote review delivery, e-commerce checkout, or payment claims are confirmed — do not
  imply online-only classes or in-site payment unless added later.

## Brand Commitments

- Name: **OBIAS Nursing & Allied Courses Review Center**.
- Existing taglines in real use: "Your Partner in Passing. Your Future in Healthcare." and "Your
  Success Is Our Mission!"
- Existing logo mark: a red/maroon ribbon-and-caduceus "OBIAS" emblem (reference image on file).
- Existing incumbent site (reference screenshot, not this codebase) uses a maroon/crimson +
  gold/yellow + navy palette with a bold, energetic, slightly promotional review-center tone. This
  is evidence/anti-reference for a redesign, not a locked constraint — new-work will decide whether
  to preserve or evolve it.

## Evidence on Hand

Real content confirmed by the user and captured from a reference screenshot
(`apps/web/public/fd55d12c-35f0-40e1-8d3e-e66614c4b2ed.png`):

- **Stats:** 20+ years of excellence; thousands of successful reviewees; high passing rate; many
  healthcare professionals now serving the community. (Exact numeric pass-rate percentage not yet
  provided — use the qualitative claims above; do not invent a specific percentage.)
- **Testimonials:** Maria S. (NLE Passer), John D. (MedTech Passer), Alyssa M. (Midwifery Passer) —
  short real quotes on file in the reference screenshot.
- **Contact:** Phones 0917 165 4780, 0939 126 2602, 0951 562 4048, 0923 812 2649; address Jinyang
  Bldg. #1, Manila Doctors Access Road, Almanza Uno, Las Piñas City; Facebook "Obias Nursing &
  Allied Courses Review Center"; email centerofreviewfornursing@gmail.com.
- **Accreditation/partner logos:** mentioned as existing but not yet supplied as files — treat as
  outstanding asset, use a clearly-marked placeholder lockup until real logo files are provided.

## Product Principles

1. Lead with proof, not adjectives — years of operation, reviewee outcomes, and instructor
   credibility carry more weight than generic marketing language.
2. Every major section should have a clear, low-friction path to enroll or inquire — the site's
   job is conversion, not just information.
3. Respect the real operating context: one physical center, phone/Facebook-first contact culture,
   enrollment-window urgency — don't design around assumptions (multi-branch, online-only, etc.)
   the evidence doesn't support.
4. Preserve real brand facts (name, taglines, contact info, program list) exactly; never fabricate
   numbers, logos, or quotes beyond what's on file.

## Accessibility & Inclusion

No product-specific accessibility requirement established beyond standard web accessibility
practice (contrast, keyboard navigation, alt text) — apply as a baseline.
