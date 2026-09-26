import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { listPrograms } from '@/lib/public-api';
import { fetchPublicSettings } from '@/lib/public-settings';
import { Icon, IconBadge, type IconName } from './icons';
import { TestimonialCarousel, type Testimonial } from './testimonial-carousel';

export const metadata: Metadata = {
  title: 'Your Partner in Passing. Your Future in Healthcare.',
  description:
    '20+ years of proven results preparing nursing and allied-health graduates for their board exams.',
};

const HERO_HIGHLIGHTS: { label: string; icon: IconName }[] = [
  { label: 'Comprehensive Review Materials', icon: 'book' },
  { label: 'Proven Results', icon: 'target' },
  { label: 'Experienced Review Instructors', icon: 'people' },
];

// Curated copy and icons per board program. `match` finds the published
// program (by name) whose page the card links to; without one it falls back
// to the full list. `lines` sets the card title's line breaks.
const PROGRAMS: { name: string; lines: string[]; match: string; blurb: string; icon: IconName }[] = [
  { name: 'Nursing (NLE)', lines: ['Nursing', '(NLE)'], match: 'nursing', blurb: 'Comprehensive review for future RNs', icon: 'stethoscope' },
  { name: 'Midwifery', lines: ['Midwifery'], match: 'midwifery', blurb: 'Build a brighter future in midwifery', icon: 'midwifery' },
  { name: 'Medical Technology', lines: ['Medical', 'Technology'], match: 'medical tech', blurb: 'Pass with confidence', icon: 'microscope' },
  { name: 'Physical Therapy', lines: ['Physical', 'Therapy'], match: 'physical therapy', blurb: 'Achieve your goals in allied health', icon: 'therapy' },
];

const ALSO_OFFERING = ['Seminar & Training', 'Caregiving Course', 'Foreign Language Skills'];

const FEATURES: { lines: string[]; blurb: string; icon: IconName }[] = [
  { lines: ['Experienced', 'Review Instructors'], blurb: 'Learn from industry experts and topnotchers.', icon: 'people' },
  { lines: ['Comprehensive', 'Review Materials'], blurb: 'Updated and structured review resources.', icon: 'book' },
  { lines: ['Proven Results'], blurb: 'High passing rate and success stories.', icon: 'target' },
  { lines: ['Affordable', 'Programs'], blurb: 'Quality review at affordable rates.', icon: 'peso' },
];

const STATS: { value: string; label: string[]; icon: IconName }[] = [
  { value: '20+', label: ['Years of Excellence'], icon: 'graduationCap' },
  { value: 'Thousands', label: ['of Successful Reviewees'], icon: 'people' },
  { value: 'High', label: ['Passing Rate'], icon: 'chart' },
  { value: 'Many', label: ['Healthcare Professionals', 'Now Serving the Community'], icon: 'heart' },
];

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Maria S.',
    role: 'NLE Passer',
    quote: 'Obias Review Center gave me the confidence and knowledge I needed to pass the NLE. Highly recommended!',
    photo: '/brands/marketing/resources/review_person_01.png',
  },
  {
    name: 'John D.',
    role: 'MedTech Passer',
    quote: 'The instructors are very approachable and the materials are comprehensive. Worth it!',
    photo: '/brands/marketing/resources/review_person_02.png',
  },
  {
    name: 'Alyssa M.',
    role: 'Midwifery Passer',
    quote: 'A big thank you to Obias for helping me achieve my dream. Excellent review experience!',
    photo: '/brands/marketing/resources/review_person_03.png',
  },
];

const RESOURCES = '/brands/marketing/resources';

export default async function MarketingHomePage() {
  // The home page must render even when the API is down: settings fall back
  // to the center's real details, and program cards to the full list.
  const [settings, published] = await Promise.all([fetchPublicSettings(), listPrograms().catch(() => [])]);
  const programHref = (match: string) => {
    const program = published.find((p) => p.name.toLowerCase().includes(match));
    return program ? `/programs/${program.slug}` : '/offerings';
  };
  // Banner text is admin-controlled (Settings > Enrollment); closing
  // enrollment swaps it for a next-intake prompt.
  const banner = settings.enrollmentOpen ? settings.enrollmentNotice : 'Enrollment closed · Inquire for the next intake';

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-gold">
        <Image
          src="/696c7d29-ae75-4ef5-b54e-0a725cca54a7.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Soft light wash behind the headline, as in the reference. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(100deg,rgb(255_251_230/0.6)_0%,rgb(255_251_230/0.4)_35%,transparent_62%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-10 sm:pt-12 lg:flex lg:min-h-[min(46.5vw,680px)] lg:items-center lg:py-12">
          <div className="relative z-10 lg:max-w-[min(41vw,500px)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-brand-navy sm:text-xs">
              20+ Years of Excellence
            </p>
            <h1 className="mt-3 w-fit uppercase">
              <span className="block font-sans text-[clamp(3.4rem,6vw,5.4rem)] font-extrabold leading-[0.9] tracking-[-0.02em] text-brand-maroon">
                Obias
              </span>
              <span className="block font-sans text-[clamp(2rem,3.5vw,3.15rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-brand-navy">
                Nursing &amp;
                <br />
                Allied Courses
              </span>
              <span className="mt-2 flex items-center gap-3 font-heading text-[clamp(1.35rem,2.2vw,1.95rem)] font-bold leading-none tracking-[0.05em] text-brand-maroon">
                <span className="flex flex-1 items-center" aria-hidden="true">
                  <span className="h-1.5 w-1.5 bg-brand-maroon" />
                  <span className="ml-1.5 h-0.5 flex-1 bg-brand-maroon" />
                </span>
                Review Center
                <span className="h-0.5 flex-1 bg-brand-maroon" aria-hidden="true" />
              </span>
            </h1>
            <p className="font-script mt-3 whitespace-nowrap text-[clamp(1rem,4.1vw,1.6rem)] leading-tight text-brand-navy lg:text-[min(1.76vw,1.6rem)]">
              Preparing Future Healthcare Professionals
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
              {HERO_HIGHLIGHTS.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <Icon name={item.icon} className="h-8 w-8 shrink-0 text-brand-maroon" />
                  <span className="max-w-[7.5rem] text-[0.6875rem] font-medium leading-tight text-brand-navy">{item.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex min-w-[10.5rem] items-center justify-center gap-2.5 rounded-md bg-brand-maroon px-7 py-3 font-heading text-lg font-medium tracking-wide text-white shadow-[0_6px_14px_-4px_rgb(107_20_31/0.45)] transition-colors hover:bg-brand-maroon-dark"
              >
                Enroll Now
                <Icon name="arrowRight" className="h-5 w-5" />
              </Link>
              <Link
                href="/offerings"
                className="inline-flex min-w-[8.5rem] items-center justify-center rounded-md border-2 border-brand-maroon bg-white px-7 py-3 font-heading text-lg font-medium tracking-wide text-brand-navy transition-colors hover:bg-brand-maroon hover:text-white"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>

        {/* Hero photo: cut-out anchored bottom-right; its cropped right edge fades out. */}
        <Image
          src={`${RESOURCES}/hero_people_studying.png`}
          alt="Smiling OBIAS reviewees in nursing uniforms studying together"
          width={824}
          height={428}
          sizes="(min-width: 1024px) 62vw, 100vw"
          priority
          className="relative ml-auto mt-8 w-full max-w-2xl [mask-image:linear-gradient(to_right,black_92%,transparent)] lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:w-[min(62vw,920px)] lg:max-w-none"
        />
      </section>

      {/* Enrollment banner */}
      <div className="bg-[linear-gradient(90deg,var(--brand-maroon-dark),var(--brand-maroon)_30%,var(--brand-maroon)_70%,var(--brand-maroon-dark))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-x-7 gap-y-2 px-6 py-3.5 text-center text-white md:flex-row">
          {banner && (
            <p className="flex items-center gap-3 font-heading text-[1.6rem] font-semibold uppercase leading-none tracking-wide sm:text-[1.85rem]">
              <Icon name="megaphone" className="h-8 w-8 shrink-0 text-brand-gold" />
              {banner}
            </p>
          )}
          {banner && <span className="hidden h-0.5 w-16 bg-white/80 md:block" aria-hidden="true" />}
          <p className="text-sm sm:text-base">&ldquo;Your Partner in Passing. Your Future in Healthcare.&rdquo;</p>
        </div>
      </div>

      {/* Programs */}
      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.01em] text-brand-navy font-sans! sm:text-[2rem]">
              Our Review Programs
            </h2>
            <p className="mt-1 text-slate-600">Comprehensive review programs designed to help you pass and excel.</p>
          </div>
          <Link
            href="/offerings"
            className="inline-flex shrink-0 items-center gap-2.5 self-start rounded-lg bg-brand-gold px-6 py-2.5 font-heading text-base font-semibold tracking-wide text-brand-navy shadow-[0_4px_10px_-3px_rgb(215_161_61/0.6)] transition-colors hover:bg-brand-gold-dark sm:self-auto"
          >
            View All Programs
            <Icon name="arrowRight" className="h-4.5 w-4.5" />
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_1.5fr]">
          {PROGRAMS.map((program) => (
            <div
              key={program.name}
              className="flex flex-col items-center rounded-lg bg-[#fdf8ee] px-4 pb-5 pt-4 text-center ring-1 ring-[#f1e4c8] shadow-[0_2px_8px_-4px_rgb(15_30_61/0.12)]"
            >
              <IconBadge name={program.icon} className="h-[4.5rem] w-[4.5rem]" iconClassName="h-9 w-9" />
              <h3 className="mt-3 text-[1.0625rem] font-semibold uppercase leading-[1.15] tracking-wide text-brand-navy">
                {program.lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </h3>
              <p className="mt-2 max-w-[10rem] text-[0.75rem] leading-snug text-slate-500">{program.blurb}</p>
              <Link
                href={programHref(program.match)}
                aria-label={`Learn more about ${program.name}`}
                className="mt-auto inline-flex items-center gap-1.5 pt-4 font-heading text-[0.95rem] font-semibold tracking-wide text-brand-maroon transition-colors hover:text-brand-maroon-dark"
              >
                Learn More
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </div>
          ))}

          <div className="col-span-2 rounded-lg bg-[#fdf1d6] px-6 py-6 ring-1 ring-[#f3e2b8] md:col-span-4 lg:col-span-1">
            <h3 className="text-xl font-semibold text-brand-navy">Also Offering:</h3>
            <ul className="mt-5 space-y-4">
              {ALSO_OFFERING.map((item) => (
                <li key={item} className="flex items-center gap-3 font-heading text-[1.05rem] font-medium tracking-wide text-brand-navy">
                  <Icon name="checkCircle" className="h-5 w-5 shrink-0 text-brand-maroon" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="bg-[linear-gradient(110deg,#fff5e3_0%,#ffffff_38%,#ffffff_62%,#fff5e3_100%)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-9 text-center lg:grid-cols-4 lg:divide-x lg:divide-[#ecdcbc]">
          {FEATURES.map((feature) => (
            <div key={feature.lines.join(' ')} className="flex flex-col items-center px-3">
              <IconBadge name={feature.icon} className="h-14 w-14" iconClassName="h-7 w-7" />
              <h3 className="mt-3 text-[0.95rem] font-semibold leading-snug text-brand-navy font-sans!">
                {feature.lines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </h3>
              <p className="mt-2 max-w-[12rem] text-[0.8125rem] leading-snug text-slate-500">{feature.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src={`${RESOURCES}/hero_healthcare_students.png`}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_35%] opacity-[0.07] grayscale"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-8 text-center lg:grid-cols-4 lg:divide-x lg:divide-white/25">
          {STATS.map((stat) => (
            <div key={stat.value} className="flex flex-col items-center px-3">
              <Icon name={stat.icon} className="h-9 w-9 text-white" />
              <p className="mt-2 font-heading text-[2.1rem] font-semibold leading-none text-brand-gold">{stat.value}</p>
              <p className={`mt-1.5 text-white ${stat.label.length > 1 ? 'text-[0.8125rem] leading-tight' : 'text-[0.95rem]'}`}>
                {stat.label.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-[#f6f7f9]">
        <div className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
          <div className="text-center">
            <h2 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.01em] text-brand-navy font-sans! sm:text-[2rem]">
              What Our Reviewees Say
            </h2>
            <p className="mt-1 text-slate-600">Real stories. Real success.</p>
          </div>
          <div className="mt-7">
            <TestimonialCarousel items={TESTIMONIALS} />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-brand-gold">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-7 text-center md:flex-row md:text-left">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-maroon text-brand-gold">
            <Icon name="people" className="h-10 w-10" />
          </span>
          <div className="flex-1">
            <h2 className="text-[1.9rem] font-semibold leading-tight tracking-wide text-brand-navy sm:text-[2.1rem]">
              Be Part of Our Success Story!
            </h2>
            <p className="mt-0.5 text-brand-navy sm:text-lg">Enroll now and take the next step toward your healthcare career.</p>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center gap-2.5 rounded-md bg-brand-maroon px-9 py-3 font-heading text-lg font-medium tracking-wide text-white shadow-[0_6px_14px_-4px_rgb(107_20_31/0.45)] transition-colors hover:bg-brand-maroon-dark"
          >
            Enroll Now
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
