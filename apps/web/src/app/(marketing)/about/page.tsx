import type { Metadata } from 'next';
import Image from 'next/image';
import { Icon, type IconName } from '../icons';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    '20+ years preparing nursing and allied-health graduates for their board licensure exams in Las Piñas City.',
};

const RESOURCES = '/brands/marketing/resources';

const PILLARS: { title: string; icon: IconName; body?: string; list?: string[] }[] = [
  {
    title: 'Our Mission',
    icon: 'people',
    body: 'To provide high-quality, affordable, and effective review programs that equip future healthcare professionals with the knowledge, confidence, and values needed to pass their licensure exams and serve the community.',
  },
  {
    title: 'Our Vision',
    icon: 'target',
    body: 'To be the most trusted and preferred review center for nursing and allied health courses in the Philippines, known for our excellence, integrity, and commitment to student success.',
  },
  {
    title: 'Our Core Values',
    icon: 'heart',
    list: [
      'Excellence in education',
      'Integrity and honesty',
      'Commitment to student success',
      'Service to the community',
      'Continuous improvement',
    ],
  },
];

const STATS: { value: string; label: string; icon: IconName }[] = [
  { value: '20+', label: 'Years of Excellence', icon: 'trophy' },
  { value: 'Thousands', label: 'of Successful Reviewees', icon: 'people' },
  { value: 'High', label: 'Passing Rate', icon: 'chart' },
  { value: 'Many Serving', label: 'the Community', icon: 'heart' },
];

// The center's lobby sign, drawn from the real logo and wordmark on a softly
// lit wall — there is no photo of the office yet. `className` sets the
// panel's position and size; the sign sits in the upper part of the wall.
function SignWall({ className = '' }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#ffffff_0%,#f4f1ec_45%,#e4ded4_100%)] ${className}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,#d9c3a0,#b8976a)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-[18%] h-px bg-black/10" aria-hidden="true" />
      <div className="absolute inset-x-[8%] bottom-[30%] top-[10%] flex items-center justify-center gap-[4%] drop-shadow-[0_4px_6px_rgb(0_0_0/0.18)]">
        <Image src="/obias_crn_logo_transparent.png" alt="" width={311} height={236} className="h-[min(100%,11rem)] w-auto max-w-[42%] object-contain" />
        <div className="flex flex-col">
          <span className="font-heading text-[clamp(1.75rem,4vw,3rem)] font-bold leading-[0.9] tracking-wide text-brand-maroon">
            OBIAS
          </span>
          <span className="mt-1.5 whitespace-nowrap font-heading text-[clamp(0.7rem,1.5vw,1.05rem)] font-semibold uppercase leading-tight text-brand-navy">
            Nursing &amp; Allied Courses
            <br />
            Review Center
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src={`${RESOURCES}/hero_people_studying.png`}
          alt=""
          width={824}
          height={428}
          priority
          sizes="60vw"
          className="absolute bottom-0 right-0 w-[min(70vw,900px)] opacity-35 grayscale-[30%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--brand-navy)_0%,rgb(15_30_61/0.92)_40%,rgb(15_30_61/0.55)_100%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl text-white">
            <h1 className="text-[2.5rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">About Obias</h1>
            <p className="mt-3 text-lg font-semibold sm:text-xl">20+ Years of Excellence in Healthcare Review Education</p>
            <p className="mt-4 text-sm leading-relaxed text-white/85 sm:text-[0.95rem]">
              Obias Nursing &amp; Allied Courses Review Center is dedicated to helping aspiring healthcare
              professionals achieve their dreams through quality review programs, experienced instructors, and
              comprehensive review materials.
            </p>
          </div>
          <div className="relative self-center pr-2 lg:mr-6" aria-hidden="true">
            <p className="font-script -rotate-[10deg] text-center text-[2.1rem] leading-[1.25] text-white sm:text-[2.6rem]">
              Same Passion
              <br />
              <span className="ml-6">A Healthier Tomorrow</span>
            </p>
            <svg viewBox="0 0 300 30" className="absolute -bottom-5 left-4 w-[88%] -rotate-[10deg] text-brand-gold">
              <path fill="currentColor" d="M4 22C70 10 170 4 296 6c-60 4-150 10-220 22-30 1-58 0-72-6Z" />
            </svg>
          </div>
        </div>
      </section>

      {/* Mission, vision, values */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <div className="relative">
          <SignWall className="relative aspect-[4/3.3] rounded-xl shadow-[0_10px_30px_-12px_rgb(15_30_61/0.35)]" />
          <figure className="relative -mt-24 ml-auto mr-0 w-[80%] rounded-xl bg-[#fdf1d0] px-7 py-7 shadow-[0_10px_24px_-10px_rgb(15_30_61/0.3)] sm:-mt-40 sm:w-[76%]">
            <blockquote className="text-[1.15rem] leading-relaxed text-brand-navy sm:text-[1.3rem]">
              &ldquo;We believe in the power of education to build a brighter and healthier future for our
              community.&rdquo;
            </blockquote>
            <figcaption className="mt-4 text-sm text-brand-navy/80">&mdash; Obias Review Center</figcaption>
          </figure>
        </div>

        <div className="flex flex-col justify-center gap-9">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="flex gap-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-maroon shadow-[0_4px_10px_-3px_rgb(215_161_61/0.6)]">
                <Icon name={pillar.icon} className="h-7 w-7" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-brand-navy font-sans!">{pillar.title}</h2>
                {pillar.body && <p className="mt-2 text-[0.9rem] leading-relaxed text-slate-600">{pillar.body}</p>}
                {pillar.list && (
                  <ul className="mt-2 space-y-1.5">
                    {pillar.list.map((item) => (
                      <li key={item} className="flex items-center gap-3 text-[0.9rem] text-slate-600">
                        <span className="h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-brand-maroon" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-[linear-gradient(110deg,#fdf1d6_0%,#fff8e8_50%,#fdf1d6_100%)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-9 text-center lg:grid-cols-4 lg:divide-x lg:divide-[#ecdcbc]">
          {STATS.map((stat) => (
            <div key={stat.value} className="flex flex-col items-center px-3">
              <Icon name={stat.icon} className="h-10 w-10 text-brand-maroon" />
              <p className="mt-2 text-[1.75rem] font-bold leading-none text-brand-navy">{stat.value}</p>
              <p className="mt-1.5 text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing banner */}
      <section className="relative overflow-hidden bg-[#e9e4dc]">
        <SignWall className="absolute inset-y-0 left-[32%] right-0 hidden md:block" />
        <div className="relative flex min-h-[15rem] items-center bg-brand-gold px-6 py-12 md:w-[44%] md:[clip-path:polygon(0_0,100%_0,82%_100%,0_100%)] md:py-0 md:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">
          <p className="text-[2rem] font-bold leading-[1.15] text-brand-navy font-sans! sm:text-[2.4rem]">
            Together,
            <br />
            we build a healthier
            <br />
            tomorrow.
          </p>
        </div>
      </section>
    </div>
  );
}
