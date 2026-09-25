import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { fetchPublicSettings } from '@/lib/public-settings';

export const metadata: Metadata = {
  title: 'Your Partner in Passing. Your Future in Healthcare.',
  description:
    '20+ years of proven results preparing nursing and allied-health graduates for their board exams.',
};

const HERO_HIGHLIGHTS = [
  { label: 'Comprehensive Review Materials' },
  { label: 'Proven Results' },
  { label: 'Experienced Review Instructors' },
];

const PROGRAMS = [
  { name: 'Nursing (NLE)', blurb: 'Comprehensive review for future RNs.', icon: 'stethoscope' as const },
  { name: 'Midwifery', blurb: 'Build a brighter future in midwifery.', icon: 'caregiving' as const },
  { name: 'Medical Technology', blurb: 'Pass with confidence.', icon: 'microscope' as const },
  { name: 'Physical Therapy', blurb: 'Achieve your goals in allied health.', icon: 'therapy' as const },
];

const ALSO_OFFERING = ['Seminar & Training', 'Caregiving Course', 'Foreign Language Skills'];

const FEATURES = [
  {
    name: 'Experienced Review Instructors',
    blurb: 'Learn from industry experts and topnotchers.',
    icon: 'people' as const,
  },
  {
    name: 'Comprehensive Review Materials',
    blurb: 'Updated and structured review resources.',
    icon: 'book' as const,
  },
  { name: 'Proven Results', blurb: 'High passing rate and success stories.', icon: 'target' as const },
  { name: 'Affordable Programs', blurb: 'Quality review at affordable rates.', icon: 'peso' as const },
];

const STATS = [
  { value: '20+', label: 'Years of Excellence', icon: 'graduationCap' as const },
  { value: 'Thousands', label: 'of Successful Reviewees', icon: 'people' as const },
  { value: 'High', label: 'Passing Rate', icon: 'chart' as const },
  {
    value: 'Many',
    label: 'Healthcare Professionals Now Serving the Community',
    icon: 'heart' as const,
  },
];

const TESTIMONIALS = [
  {
    name: 'Maria S.',
    role: 'NLE Passer',
    quote: 'Obias Review Center gave me the confidence and knowledge I needed to pass the NLE. Highly recommended!',
  },
  {
    name: 'John D.',
    role: 'MedTech Passer',
    quote: 'The instructors are very approachable and the materials are comprehensive. Worth it!',
  },
  {
    name: 'Alyssa M.',
    role: 'Midwifery Passer',
    quote: 'A big thank you to Obias for helping me achieve my dream. Excellent review experience!',
  },
];

const ICON_PATHS = {
  stethoscope:
    'M8 3v5.5a4 4 0 0 0 8 0V3M8 3H6M16 3h2M12 12.5V16a5 5 0 0 0 10 0v-1.5M22 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  caregiving:
    'M12 20.5s-6.5-4-8.5-8.2C2.3 9.6 3.3 6.7 6 6c1.9-.5 3.6.5 4.6 2M12 20.5s6.5-4 8.5-8.2c1.2-2.7.2-5.6-2.5-6.3-1.9-.5-3.6.5-4.6 2M9 10.5h6M12 7.5v6',
  microscope:
    'M9 21h9M12 21v-4M8 17h7l-1-4.5M9 12.5h4M10.5 12.5V6a1.5 1.5 0 0 1 3 0v1M14.5 4.5l2 2M6 17a4 4 0 0 1 4-4',
  therapy:
    'M13 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10 21l1.5-6.5L9 13l1-4.5c.2-1 1-1.5 2-1.5s1.8.5 2 1.5L15 13l-2.5 1.5L14 21M9 13l-3 2M15 13l3 2',
  people:
    'M7 20v-1.5a3.5 3.5 0 0 1 3.5-3.5h3a3.5 3.5 0 0 1 3.5 3.5V20M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20v-1a3 3 0 0 1 2.5-2.96M21 20v-1a3 3 0 0 0-2.5-2.96M6.5 8.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM17.5 8.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5ZM4 18.5A2.5 2.5 0 0 1 6.5 16H20',
  target:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  peso: 'M6 21V4h6.5a4 4 0 1 1 0 8H6M4 11.5h11M4 14.5h9',
  graduationCap:
    'M2 9.5 12 5l10 4.5-10 4.5-10-4.5ZM6 11.7v4.8c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.8M20 9.5v6',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  heart: 'M12 20.5S3.5 15.4 3.5 9.3A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 2.9C20.5 15.4 12 20.5 12 20.5Z',
} as const;

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function IconBadge({ name, size = 'md' }: { name: IconName; size?: 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'h-[72px] w-[72px]' : 'h-14 w-14';
  const iconSize = size === 'lg' ? 'h-8 w-8' : 'h-6 w-6';
  return (
    <div className={`flex ${dimensions} shrink-0 items-center justify-center rounded-full bg-brand-maroon text-white`}>
      <Icon name={name} className={iconSize} />
    </div>
  );
}

function Initial({ name }: { name: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-maroon text-sm font-semibold text-white">
      {name.charAt(0)}
    </div>
  );
}

export default async function MarketingHomePage() {
  const settings = await fetchPublicSettings();
  // Banner text is admin-controlled (Settings > Enrollment); closing
  // enrollment swaps it for a next-intake prompt.
  const banner = settings.enrollmentOpen ? settings.enrollmentNotice : 'Enrollment closed · Inquire for the next intake';

  return (
    <div>
      {/* Hero */}
      <header
        className="relative bg-brand-gold bg-cover bg-center"
        style={{ backgroundImage: "url('/696c7d29-ae75-4ef5-b54e-0a725cca54a7.png')" }}
      >
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20 lg:pb-24">
          <div>
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-maroon-dark">
              20+ Years of Excellence
            </div>
            <h1 className="mt-3 font-heading text-[clamp(2.4rem,4.6vw,3.75rem)] leading-[1.02] font-bold uppercase text-brand-maroon">
              Obias
              <span className="block text-slate-900">Nursing &amp; Allied Courses</span>
              <span className="block text-brand-maroon">Review Center</span>
            </h1>
            <p className="font-script mt-3 text-4xl text-slate-800">Preparing Future Healthcare Professionals</p>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-md bg-brand-maroon px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-maroon-dark"
              >
                Enroll Now &rarr;
              </Link>
              <Link
                href="/offerings"
                className="inline-flex items-center gap-2 rounded-md border-2 border-brand-maroon px-6 py-3 text-sm font-bold text-brand-maroon transition hover:bg-brand-maroon hover:text-white"
              >
                Learn More
              </Link>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5">
              {HERO_HIGHLIGHTS.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="h-[7px] w-[7px] rounded-full bg-brand-maroon" aria-hidden="true" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative hidden h-[440px] sm:block lg:h-[520px] lg:-mr-10">
            <div
              className="absolute left-1/2 top-1/2 z-0 h-[573px] w-[550px] -translate-x-1/2 -translate-y-1/2"
              style={{
                maskImage: 'radial-gradient(ellipse 68% 72% at 50% 55%, black 55%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 68% 72% at 50% 55%, black 55%, transparent 100%)',
              }}
            >
              <Image
                src="/02_graduate_holding_diploma.png"
                alt=""
                aria-hidden="true"
                fill
                className="object-contain object-bottom opacity-25"
              />
            </div>

            <div
              className="absolute inset-0 z-10"
              style={{
                maskImage: 'radial-gradient(ellipse 78% 82% at 55% 62%, black 62%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 78% 82% at 55% 62%, black 62%, transparent 100%)',
              }}
            >
              <Image
                src="/04_medical_students_microscope.png"
                alt="OBIAS medical technology reviewees examining a microscope slide"
                fill
                sizes="(min-width: 1024px) 52vw, 100vw"
                className="object-contain object-bottom drop-shadow-2xl scale-110"
                priority
              />
            </div>

            <Image
              src="/b0f44b9c-045c-4315-826f-43a03fbb53d0.png"
              alt="Experienced review instructors, five-star rated"
              width={128}
              height={128}
              className="absolute -right-4 -top-4 z-20 h-[118px] w-[118px] drop-shadow-xl"
            />
            <div className="absolute -bottom-3 left-1/2 z-20 w-[calc(100%-2rem)] -translate-x-1/2 rounded-md bg-brand-maroon px-5 py-3 text-center font-heading text-sm font-bold uppercase text-white shadow-xl">
              Thousands of Successful Reviewees &middot; High Passing Rate!
            </div>
          </div>
        </div>

        <div className="relative border-t border-black/10 bg-brand-maroon">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3.5 text-sm font-semibold text-white">
            {banner && (
              <>
                <span className="rounded bg-brand-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-maroon-dark">
                  {banner}
                </span>
                <span className="text-white/50">/</span>
              </>
            )}
            <span className="italic">&ldquo;Your Partner in Passing. Your Future in Healthcare.&rdquo;</span>
          </div>
        </div>
      </header>

      {/* Programs */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="font-heading text-3xl font-bold text-slate-900">Our Review Programs</h2>
        <p className="mt-2 text-slate-600">Comprehensive review programs designed to help you pass and excel.</p>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-3">
            {PROGRAMS.map((program) => (
              <div key={program.name} className="rounded-xl border border-slate-200 bg-brand-cream p-6">
                <IconBadge name={program.icon} />
                <h3 className="mt-4 font-heading font-semibold text-slate-900">{program.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{program.blurb}</p>
                <Link
                  href="/offerings"
                  className="mt-4 inline-block text-sm font-semibold text-brand-maroon hover:text-brand-maroon-dark"
                >
                  Learn More &rarr;
                </Link>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-brand-cream p-6">
            <h3 className="font-heading font-semibold text-slate-900">Also Offering</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {ALSO_OFFERING.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand-maroon" aria-hidden="true">
                    &#10003;
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/offerings"
              className="mt-6 inline-block w-full rounded-md bg-brand-gold px-4 py-2.5 text-center text-sm font-semibold text-brand-maroon-dark hover:bg-brand-gold-dark"
            >
              View All Programs &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="border-y border-slate-200 bg-brand-cream">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-14 text-center sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.name} className="flex flex-col items-center">
              <IconBadge name={feature.icon} size="lg" />
              <h3 className="mt-4 font-heading font-semibold text-slate-900">{feature.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-brand-navy">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 text-center sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <Icon name={stat.icon} className="h-8 w-8 text-brand-gold" />
              <div className="mt-3 font-heading text-3xl font-black text-brand-gold">{stat.value}</div>
              <div className="mt-1 text-sm text-slate-300">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold text-slate-900">What Our Reviewees Say</h2>
          <p className="mt-2 text-slate-600">Real stories. Real success.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-xl border border-slate-200 p-6">
              <blockquote className="text-sm text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <Initial name={t.name} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-sm text-slate-500">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-brand-gold">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-heading text-2xl font-bold text-brand-maroon-dark">Be Part of Our Success Story!</h2>
            <p className="mt-1 text-slate-800">Enroll now and take the next step toward your healthcare career.</p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 rounded-md bg-brand-maroon px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-maroon-dark"
          >
            Enroll Now
          </Link>
        </div>
      </section>
    </div>
  );
}
