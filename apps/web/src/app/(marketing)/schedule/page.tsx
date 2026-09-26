import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { listSchedule, publicBatchStatus } from '@/lib/public-api';
import { fetchPublicSettings, phonesOf } from '@/lib/public-settings';
import { EnrollBand } from '../enroll-band';
import { Icon } from '../icons';

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Upcoming and ongoing review batches at OBIAS Nursing & Allied Courses Review Center.',
};

const STATUS = {
  UPCOMING: { label: 'Upcoming', tone: 'bg-brand-gold text-brand-navy' },
  ACTIVE: { label: 'Ongoing', tone: 'bg-emerald-100 text-emerald-800' },
} as const;

export default async function SchedulePage() {
  const [schedule, contact] = await Promise.all([listSchedule(), fetchPublicSettings()]);
  const batches = schedule
    .map((b) => ({ ...b, shown: publicBatchStatus(b) }))
    .filter((b): b is typeof b & { shown: 'UPCOMING' | 'ACTIVE' } => b.shown !== null);
  // The center runs from one location; the branch only earns a mention if
  // batches are actually spread across more than one.
  const showBranch = new Set(batches.map((b) => b.branch.id)).size > 1;
  const phone = phonesOf(contact)[0];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src="/brands/marketing/resources/hero_people_studying.png"
          alt=""
          width={824}
          height={428}
          priority
          sizes="60vw"
          className="absolute bottom-0 right-0 w-[min(62vw,760px)] opacity-30 grayscale-[30%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--brand-navy)_0%,rgb(15_30_61/0.9)_45%,rgb(15_30_61/0.5)_100%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-14 text-white sm:py-16">
          <h1 className="text-[2.5rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">Review Schedule</h1>
          <p className="mt-3 max-w-2xl text-base text-white/85 sm:text-lg">
            Upcoming and ongoing review batches. Reserve your slot early — seats are limited.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12 sm:py-14">
        {batches.length === 0 ? (
          <div className="rounded-xl bg-[#fdf1d6] px-6 py-10 text-center ring-1 ring-[#f3e2b8]">
            <Icon name="graduationCap" className="mx-auto h-10 w-10 text-brand-maroon" />
            <h2 className="mt-3 text-xl font-bold text-brand-navy font-sans!">New batches are being scheduled</h2>
            <p className="mx-auto mt-2 max-w-md text-slate-600">
              Contact us for the next intake dates and we&apos;ll help you reserve a slot.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-md bg-brand-maroon px-6 py-2.5 font-heading text-base font-medium tracking-wide text-white transition-colors hover:bg-brand-maroon-dark"
              >
                Send an Inquiry
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 rounded-md border-2 border-brand-maroon px-6 py-2 font-heading text-base font-medium tracking-wide text-brand-navy transition-colors hover:bg-brand-maroon hover:text-white"
                >
                  <Icon name="phone" className="h-4 w-4" />
                  {phone}
                </a>
              )}
            </div>
          </div>
        ) : (
          <ol className="space-y-4">
            {batches.map((batch) => {
              const status = STATUS[batch.shown];
              return (
                <li
                  key={batch.id}
                  className="flex flex-col gap-5 rounded-xl bg-white px-5 py-5 ring-1 ring-slate-200 shadow-[0_4px_16px_-8px_rgb(15_30_61/0.18)] sm:flex-row sm:items-center sm:px-6"
                >
                  {/* Calendar tile */}
                  <time
                    dateTime={batch.startDate}
                    className="flex h-20 w-20 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-brand-maroon text-white"
                  >
                    <span className="font-heading text-sm uppercase tracking-widest text-brand-gold">
                      {formatDate(batch.startDate, { month: 'short' })}
                    </span>
                    <span className="font-heading text-3xl font-semibold leading-none">
                      {formatDate(batch.startDate, { day: 'numeric' })}
                    </span>
                    <span className="mt-0.5 text-[0.65rem] text-white/75">{formatDate(batch.startDate, { year: 'numeric' })}</span>
                  </time>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-lg font-bold text-brand-navy font-sans!">{batch.name}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                    </div>
                    <p className="mt-1 font-medium text-brand-maroon">{batch.program.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(batch.startDate)}
                      {batch.endDate && ` – ${formatDate(batch.endDate)}`}
                      {showBranch && ` · ${batch.branch.name}`}
                    </p>
                  </div>

                  <Link
                    href="/contact"
                    aria-label={`Reserve a slot in ${batch.name}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-md bg-brand-maroon px-5 py-2.5 font-heading text-base font-medium tracking-wide text-white transition-colors hover:bg-brand-maroon-dark sm:self-auto"
                  >
                    Reserve a Slot
                    <Icon name="arrowRight" className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <EnrollBand title="Ready to join a batch?" />
    </div>
  );
}
