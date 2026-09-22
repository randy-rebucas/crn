import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

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
  { name: 'Nursing (NLE)', blurb: 'Comprehensive review for future RNs.' },
  { name: 'Midwifery', blurb: 'Build a brighter future in midwifery.' },
  { name: 'Medical Technology', blurb: 'Pass with confidence.' },
  { name: 'Physical Therapy', blurb: 'Achieve your goals in allied health.' },
];

const ALSO_OFFERING = ['Seminar & Training', 'Caregiving Course', 'Foreign Language Skills'];

const FEATURES = [
  { name: 'Experienced Review Instructors', blurb: 'Learn from industry experts and topnotchers.' },
  { name: 'Comprehensive Review Materials', blurb: 'Updated and structured review resources.' },
  { name: 'Proven Results', blurb: 'High passing rate and success stories.' },
  { name: 'Affordable Programs', blurb: 'Quality review at affordable rates.' },
];

const STATS = [
  { value: '20+', label: 'Years of Excellence' },
  { value: 'Thousands', label: 'of Successful Reviewees' },
  { value: 'High', label: 'Passing Rate' },
  { value: 'Many', label: 'Healthcare Professionals Now Serving the Community' },
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

function Initial({ name }: { name: string }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-maroon/10 text-sm font-semibold text-brand-maroon">
      {name.charAt(0)}
    </div>
  );
}

export default function MarketingHomePage() {
  return (
    <div>
      {/* Hero */}
      <header
        className="relative overflow-hidden bg-brand-gold bg-cover bg-center"
        style={{ backgroundImage: "url('/6236a1dd-c30d-4aa2-9368-f70343d18ab6.png')" }}
      >
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
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

          <div className="relative hidden h-[420px] sm:block">
            <Image
              src="/102ff1fa-5971-403d-8e78-bd3d7bdd0415.png"
              alt="OBIAS students and graduates"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-contain object-right"
              priority
            />
            <div className="absolute right-2 top-2 flex h-[110px] w-[110px] items-center justify-center rounded-full border-4 border-brand-navy bg-brand-navy text-center font-heading text-xs font-bold uppercase leading-tight text-brand-gold shadow-xl">
              Experienced
              <br />
              Review
              <br />
              Instructors
            </div>
            <div className="absolute bottom-16 right-0 rounded-md bg-brand-maroon px-5 py-3 font-heading text-sm font-bold uppercase text-white shadow-xl">
              Thousands of Successful Reviewees
              <br />
              High Passing Rate!
            </div>
          </div>
        </div>

        <div className="relative border-t border-black/10 bg-brand-maroon">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3.5 text-sm font-semibold text-white">
            <span className="rounded bg-brand-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-maroon-dark">
              Now Accepting Enrollees!
            </span>
            <span className="text-white/50">/</span>
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
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-maroon text-lg font-bold text-white">
                  {program.name.charAt(0)}
                </div>
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
            <div key={feature.name}>
              <h3 className="font-heading font-semibold text-slate-900">{feature.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-brand-navy">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 text-center sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="font-heading text-3xl font-black text-brand-gold">{stat.value}</div>
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
