---
name: OBIAS Nursing & Allied Courses Review Center
description: Public marketing site for a 20+ year board-exam review center — proof-led, confident, institutional.
colors:
  maroon: "#8b1a2b"
  maroon-dark: "#6b141f"
  maroon-light: "#a02033"
  gold: "#f5c518"
  gold-dark: "#d7a13d"
  navy: "#0f1e3d"
  navy-light: "#152238"
  cream: "#fdf6e9"
  neutral-ink: "#0f172a"
  neutral-body: "#475569"
  neutral-border: "#e2e8f0"
  neutral-bg: "#ffffff"
typography:
  display:
    fontFamily: "Oswald, Arial, Helvetica, sans-serif"
    fontSize: "clamp(2.4rem, 4.6vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "normal"
  headline:
    fontFamily: "Oswald, Arial, Helvetica, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Oswald, Arial, Helvetica, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Poppins, Arial, Helvetica, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Poppins, Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.18em"
  script:
    fontFamily: "Pacifico, cursive"
    fontSize: "1.5rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "12px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.maroon}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.maroon-dark}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.maroon}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  button-secondary-hover:
    backgroundColor: "{colors.maroon}"
    textColor: "{colors.neutral-bg}"
  button-accent:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.maroon-dark}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-accent-hover:
    backgroundColor: "{colors.gold-dark}"
  card:
    backgroundColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "24px"
  icon-badge:
    backgroundColor: "{colors.maroon}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.full}"
    size: "72px"
  eyebrow-badge-urgency:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.maroon-dark}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
---

# Design System: OBIAS Nursing & Allied Courses Review Center

## Overview

**Creative North Star: "The Trusted Ribbon"**

This system reads as a real institution with a 20-year record, not a startup. It takes its cue from OBIAS's own ribbon-and-caduceus seal: maroon and gold rendered with the weight of an emblem, not a gradient — ribbon banners, star-rated badges, and circular seals are structural devices, not decoration. Every section leads with a number, a name, or a result before it leads with an adjective — proof is the decoration.

The palette is loud where it counts (gold urgency badges, maroon CTAs and ribbons) and quiet everywhere else (cream surfaces, slate body copy). Condensed uppercase headings (Oswald) carry institutional authority; a single script accent (Pacifico) softens the hero with a handwritten, personal touch amid the otherwise formal system. Surfaces stay flat — separation comes from a cream fill or a hairline border, never a drop shadow on ordinary cards — so the maroon and gold accents, and the emblem-style badges, are what draws the eye. Real photography (students, graduates, instructors) is load-bearing evidence, arranged as a diagonal-cut collage in the hero rather than a single rectangular image, giving the top of the page motion without needing animation.

**Key Characteristics:**
- Condensed uppercase display type (Oswald) paired with a single handwritten script accent (Pacifico) for warmth
- Maroon carries authority and action; gold carries urgency and achievement; navy grounds proof (stats, footer)
- Emblem-style devices — ribbon banners, star-rated circular badges, the seal logomark — carry credibility, not generic icon chips
- Flat surfaces separated by cream fill or hairline borders, not shadows; the diagonal photo collage and its overlapping badges are the deliberate exception
- Every section resolves toward an enroll/apply action

## Colors

Deep maroon and achievement gold on warm cream and crisp white, grounded by navy for high-credibility bands.

### Primary
- **Deep Institutional Maroon** (#8b1a2b): The dominant action and identity color — primary buttons, headline accents, nav wordmark, links. Darkens to #6b141f on hover/active (`maroon-dark`), lightens to #a02033 (`maroon-light`) only for rare tinted accents.

### Secondary
- **Achievement Gold** (#f5c518): Reserved for urgency and success — the "Now Accepting Enrollees" badge, hero background, closing-CTA band, and the accent card background (`gold/20`). Darkens to #d7a13d (`gold-dark`) on hover.

### Tertiary
- **Deep Navy** (#0f1e3d): Used for high-credibility, proof-bearing bands only — the stats section and the site footer. Never used for interactive elements. Lightens to #152238 (`navy-light`) for subtle panel variation within a navy section.

### Neutral
- **Slate Ink** (#0f172a / Tailwind `slate-900`): Headline and heading text.
- **Slate Body** (#475569 / Tailwind `slate-600`): Body copy, descriptions, captions.
- **Slate Border** (#e2e8f0 / Tailwind `slate-200`): Card borders, section dividers.
- **Warm Cream** (#fdf6e9): Default card and highlighted-section background — the system's "paper," used instead of pure white to keep the palette warm.
- **White** (#ffffff): Page background and header bar.

### Named Rules
**The Proof-Color Rule.** Navy is reserved for sections that state a fact (stats, contact/footer). If a section persuades or invites action, it uses maroon or gold, never navy.

## Typography

**Display/Heading Font:** Oswald (condensed, uppercase-leaning, weights 500–700)
**Body Font:** Poppins (weights 400–700)
**Script Accent Font:** Pacifico (400) — used once per page, never for body or navigation

**Character:** A condensed, confident institutional headline face paired with a clean, highly legible humanist body face, with a single cursive accent line reserved for the emotional beat of a hero ("Preparing Future Healthcare Professionals").

### Hierarchy
- **Display** (700, `clamp(2.4rem, 4.6vw, 3.75rem)`, line-height 1.02, uppercase): Hero H1 only.
- **Headline** (700, 1.875rem/`text-3xl`, line-height 1.2): Section titles ("Our Review Programs," "What Our Reviewees Say").
- **Title** (600, 1.25rem/`text-xl` down to `text-lg`, line-height 1.3): Sub-section and card headings.
- **Body** (400, 0.875rem/`text-sm`, line-height 1.6, Poppins): Paragraph copy, blurbs, testimonial quotes.
- **Label** (600, 0.75rem/`text-xs`, letter-spacing 0.18em, uppercase): Eyebrow labels and badges ("20+ Years of Excellence," "Now Accepting Enrollees!").
- **Script accent** (400, 1.5rem/`text-2xl`, Pacifico): The single emotional line under the hero headline.

### Named Rules
**The One Script Rule.** Pacifico appears at most once per page. It marks the emotional headline of a hero; it never appears in body copy, buttons, or navigation.

## Layout

Centered content column at `max-w-6xl` (1152px) with `px-6` gutters; narrower reading columns (`max-w-4xl`/`max-w-5xl`) for text-heavy pages like About and Contact. Sections stack full-bleed with alternating background color (white → cream → navy → white → gold) to mark rhythm without needing shadows or dividers beyond hairline borders. Vertical rhythm runs in large steps — `py-14` to `py-20` between sections — consistent with a small number of dense, purposeful sections rather than many short ones. Grids collapse from up to 4 columns on desktop to a single column on mobile (`sm:`/`lg:` breakpoints), with the hero going from stacked to a `1.05fr/0.95fr` two-column split at `lg`.

## Elevation & Depth

Flat by default. Cards, sections, and buttons use a cream or white fill plus a `slate-200` hairline border for separation — no ambient box-shadow. The one exception is the hero's floating emblem elements — the ribbon banner and the star-rated instructor seal — which use a lifted shadow because they are literally overlapping the diagonal photo collage and need to visually detach from it. Depth elsewhere is conveyed by color contrast between adjacent sections, not by lifting surfaces.

Homepage program and testimonial cards (matched to the approved reference comp) carry a very soft navy-tinted drop (`0 2px 8px -4px` / `0 6px 20px -8px`, ≤18% alpha) plus a hairline ring; primary buttons carry a small maroon-tinted drop. Nothing heavier.

### Shadow Vocabulary
- **Floating emblem** (`box-shadow: shadow-xl`, Tailwind default ~`0 20px 25px -5px rgb(0 0 0 / 0.1)`): Reserved for the ribbon banner, star seal, and any element overlapping the hero photo collage, never for ordinary cards.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only when an element visually floats over other content (an overlapping badge on a photo), never as generic card styling.

## Shapes

Soft-cornered but not pill-shaped: buttons and inputs use `rounded-md` (6px), cards and highlighted panels use `rounded-xl` (12px). Circular form is reserved for avatar-style elements (testimonial photos/initials, program icon badges, the hero instructor seal) and small status dots. The hero photo area is diagonally clipped into overlapping panels rather than a single rectangle — an intentional break from the flat-rectangle grid used everywhere else, reserved for the hero only. Ribbon banners (angled rectangle with notched/pointed ends) are a recurring emblem device for standout claims ("High Passing Rate!"), distinct from ordinary rounded badges. Borders are 1–2px, hairline `slate-200` on cards and a bolder 2px maroon or gold border on outline buttons and the instructor seal ring.

## Components

Buttons, cards, and inputs read as confident and direct: solid fills, clear borders, minimal ornament — an institution stating facts, not selling with decoration.

### Buttons
- **Shape:** `rounded-md` (6px), never pill-shaped.
- **Primary:** Solid Deep Institutional Maroon background, white text, bold weight, `px-6 py-3` for hero/CTA scale or `px-4 py-2` for nav scale.
- **Secondary (outline):** Transparent fill, 2px maroon border, maroon text; inverts to solid maroon fill with white text on hover.
- **Accent:** Solid Achievement Gold background, `gold-dark` maroon text (`text-brand-maroon-dark`), used for the "View All Programs" panel CTA; darkens on hover.
- **Hover/Focus:** Background darkens one step (`maroon` → `maroon-dark`, `gold` → `gold-dark`); no scale or shadow change. Transition is a plain color transition, no easing curve beyond the browser default.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px).
- **Background:** Warm cream (`brand-cream`) for the default card fill; white with a border for testimonial cards specifically.
- **Shadow Strategy:** None at rest (see Elevation & Depth — Flat-By-Default Rule).
- **Border:** 1px `slate-200` hairline.
- **Internal Padding:** `p-6` (24px) standard.

### Inputs / Fields
- **Style:** White background, 1px `slate-300` border, `rounded-md`, `px-3 py-2`, `text-sm`.
- **Focus:** Border shifts to red-600 (`focus:border-red-600`), no glow/ring.
- **Label:** Body-weight `slate-700` label sits above the field, set by the shared `Field` wrapper.

### Navigation
- **Style:** White header bar with a hairline shadow. CRN logomark plus wordmark: "OBIAS" in Oswald bold maroon over "NURSING & ALLIED COURSES / REVIEW CENTER" in two lines of tiny bold navy caps. Centered nav (Home · About · Programs · Reviews · Blog · Contact) in Poppins medium navy; the current page is maroon with a 2px maroon underline. A solid maroon "Enroll Now →" button (Oswald) anchors the right edge at all times.
- **Footer:** A navy band in four hairline-divided columns: white logomark + "Your Success is Our Mission!" with a heartbeat line; "Get in Touch" with a phone glyph and the numbers in large Oswald; "Main Center" address (red pin) and "Connect With Us" (Facebook, email); a "SCAN ME!" QR code (generated from the Facebook URL setting, hidden until it is set) with a Facebook follow prompt. A white closing row carries the full nav (current page maroon) and the copyright.

### Type pairing in practice
Poppins 800 carries the hero wordmark lines and section titles ("Our Review Programs"); Oswald carries buttons, program names, list items, stat values, the enrollment banner and the closing CTA headline. Because the global `h1–h6` rule sets Oswald unlayered, Poppins headings need `font-sans!`.

### Icon Badge
[Signature component] A filled maroon circle (~72–96px) holding a white line-art icon (stethoscope, caregiving hands, microscope, therapy figure, people, book, target, peso sign). Used for program cards and the feature-highlights row. This is the primary device for making each program/feature instantly scannable — icon first, name second, blurb third. Never use a photo or emoji here; always a simple white glyph on solid maroon.

### Ribbon Banner
[Signature component] An angled or notched-end ribbon shape in maroon with white bold uppercase text, overlapping the hero photography (e.g. "Thousands of Successful Reviewees / High Passing Rate!"). Distinct from the rectangular Eyebrow Badge below — the ribbon is reserved for claims that need to visually cut across the photo collage, not for inline text.

### Star-Rated Seal Badge
[Signature component] A circular navy badge with a bold gold 2–4px ring border, gold uppercase Oswald text ("Experienced Review Instructors"), and a row of 5 gold stars beneath the text. Overlaps the hero photo collage. This is the system's device for instructor/authority credibility specifically — reserve the star row for people-credibility claims, not for generic ratings.

### Eyebrow Badge / Label
A small uppercase Label-scale tag, either gold-on-maroon-dark-text (urgency: "Now Accepting Enrollees!", set inside the maroon promo bar beneath the hero) or maroon-on-transparent tracking-wide treatment (proof: "20+ Years of Excellence", set above the hero H1). Used for surfacing a proof-point or urgency claim inline, without needing a full section or ribbon.

### Testimonial Card
- **Avatar:** A circular photo (real reviewee headshot) at ~56–64px leads each testimonial; fall back to a maroon initial circle only when no photo exists.
- **Layout:** Quote first, then avatar + name + program-passed caption below.
- **Navigation:** A row of small dot indicators beneath the testimonial grid signals this section is a carousel on smaller viewports, with the active dot filled maroon and inactive dots light gray.

### Stat Tile
Each stat in the navy proof band leads with a small white line-art icon (graduation cap, people, upward chart, heart) above the gold number and slate-300 label — icon, then number, then label, top to bottom. Never render a stat as text alone; the icon is what makes the navy band scannable at a glance.

## Do's and Don'ts

### Do:
- **Do** lead every section with a number, name, or fact before an adjective (stats, testimonial names, program names).
- **Do** keep surfaces flat; use cream fill or a hairline border for separation instead of a shadow.
- **Do** reserve Pacifico script for exactly one line per page, and only in a hero (or the footer's "Your Success Is Our Mission!" tagline).
- **Do** keep navy sections proof-only (stats, footer contact panel) — never interactive or persuasive copy.
- **Do** keep a visible "Enroll Now" / "Enroll / Apply Now" action reachable from the header and from every major section.
- **Do** front every program/feature card and stat tile with a white line-art icon on solid maroon (or above the number for stats) — icon first, text second.
- **Do** use real reviewee photography for testimonial avatars when available; fall back to an initial circle only when no photo exists.

### Don't:
- **Don't** add drop shadows to ordinary cards or buttons — shadows are reserved for elements floating over the hero photo collage (ribbons, seal badge).
- **Don't** use gold as a large background for anything except urgency/CTA moments (hero backdrop, badges, closing CTA band); it is an accent, not a base color.
- **Don't** invent numeric claims (exact pass-rate percentages, enrollment counts) beyond the qualitative facts on file in PRODUCT.md.
- **Don't** replace the diagonal hero photo collage, ribbon banner, or star-rated seal with plain rectangular photos or generic rounded badges — these are the system's signature emblem devices, not optional flourish.
- **Don't** use the internal app's utilitarian `red-700`/slate component styling (`src/components/ui.tsx`) as a reference for this system — the two are intentionally different visual languages for different audiences (public marketing vs. authenticated operate surfaces).
