import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { listPrograms } from '@/lib/public-api';
import { EnrollBand } from '../enroll-band';
import { Icon, IconBadge, type IconName } from '../icons';
import { ADDITIONAL_OFFERINGS } from './additional-offerings';
import { BOARD_PROGRAMS } from './board-programs';

export const metadata: Metadata = {
  title: 'Programs & Offerings',
  description:
    'Review programs for Nursing, Midwifery, Medical Technology, and Physical Therapy, plus seminars, caregiving, and language courses.',
};

const RESOURCES = '/brands/marketing/resources';

function ProgramCard({ href, label, lines, blurb, icon }: {
  href: string;
  label: string;
  lines: string[];
  blurb: string;
  icon: IconName;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-[#fdf8ee] px-5 pb-6 pt-6 text-center ring-1 ring-[#f1e4c8] shadow-[0_2px_8px_-4px_rgb(15_30_61/0.12)]">
      <IconBadge name={icon} className="h-20 w-20" iconClassName="h-10 w-10" />
      <h3 className="mt-4 text-[1.125rem] font-semibold uppercase leading-[1.15] tracking-wide text-brand-navy">
        {lines.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </h3>
      <p className="mt-3 max-w-[12rem] text-[0.8125rem] leading-snug text-slate-500">{blurb}</p>
      <Link
        href={href}
        aria-label={`Learn more about ${label}`}
        className="mt-auto inline-flex items-center gap-1.5 pt-5 font-heading text-[0.95rem] font-semibold tracking-wide text-brand-maroon transition-colors hover:text-brand-maroon-dark"
      >
        Learn More
        <Icon name="arrowRight" className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default async function OfferingsPage() {
  // Cards render even when the API is down; they then point to enrollment.
  const published = await listPrograms().catch(() => []);
  const matched = new Set<string>();
  const board = BOARD_PROGRAMS.map((card) => {
    const program = published.find((p) => p.name.toLowerCase().includes(card.match));
    if (program) matched.add(program.id);
    return { ...card, href: program ? `/programs/${program.slug}` : '/contact' };
  });
  // Any other published program still gets a card, after the curated four.
  const extra = published.filter((p) => !matched.has(p.id));

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src={`${RESOURCES}/hero_healthcare_students.png`}
          alt=""
          width={798}
          height={445}
          priority
          sizes="60vw"
          className="absolute bottom-0 right-0 w-[min(62vw,760px)] opacity-30 grayscale-[30%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--brand-navy)_0%,rgb(15_30_61/0.9)_45%,rgb(15_30_61/0.5)_100%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-14 text-white sm:py-16">
          <h1 className="text-[2.5rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">Our Review Programs</h1>
          <p className="mt-3 max-w-2xl text-base text-white/85 sm:text-lg">
            Comprehensive, focused, and effective review programs to help you pass and excel.
          </p>
        </div>
      </section>

      {/* Board review programs */}
      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {board.map((card) => (
            <ProgramCard key={card.name} href={card.href} label={card.name} lines={card.lines} blurb={card.blurb} icon={card.icon} />
          ))}
          {extra.map((program) => (
            <ProgramCard
              key={program.id}
              href={`/programs/${program.slug}`}
              label={program.name}
              lines={[program.name]}
              blurb={program.description ?? 'Board review program.'}
              icon="graduationCap"
            />
          ))}
        </div>

        {/* Other programs & services */}
        <h2 className="mt-14 text-[1.75rem] font-extrabold leading-tight tracking-[-0.01em] text-brand-navy font-sans! sm:text-[2rem]">
          Other Programs &amp; Services
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ADDITIONAL_OFFERINGS.map((offering) => (
            <div
              key={offering.name}
              className="flex flex-col items-center rounded-lg bg-[#fdf8ee] px-5 pb-6 pt-6 text-center ring-1 ring-[#f1e4c8] shadow-[0_2px_8px_-4px_rgb(15_30_61/0.12)]"
            >
              <IconBadge name={offering.icon} className="h-16 w-16" iconClassName="h-8 w-8" />
              <h3 className="mt-3 text-[1.15rem] font-semibold text-brand-navy font-sans!">{offering.name}</h3>
              <p className="mt-1.5 max-w-[15rem] text-[0.875rem] leading-snug text-slate-500">{offering.blurb}</p>
              <Link
                href="/contact"
                aria-label={`Inquire about ${offering.name}`}
                className="mt-auto inline-flex items-center gap-1.5 pt-4 font-heading text-[0.95rem] font-semibold tracking-wide text-brand-maroon transition-colors hover:text-brand-maroon-dark"
              >
                Learn More
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <EnrollBand />
    </div>
  );
}
