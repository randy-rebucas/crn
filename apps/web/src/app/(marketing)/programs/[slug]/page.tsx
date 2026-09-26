import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { formatDate } from '@/lib/format';
import { coursesInOrder, excerpt, getProgram, listSchedule, publicBatchStatus } from '@/lib/public-api';
import { EnrollBand } from '../../enroll-band';
import { Icon, IconBadge, type IconName } from '../../icons';
import { boardProgramFor } from '../../offerings/board-programs';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) return { title: 'Program' };
  return { title: program.name, description: program.description ? excerpt(program.description) : undefined };
}

const WHY_OBIAS: { title: string; icon: IconName }[] = [
  { title: 'Experienced review instructors', icon: 'people' },
  { title: 'Updated, structured review materials', icon: 'book' },
  { title: 'Proven results and high passing rate', icon: 'target' },
  { title: 'Quality review at affordable rates', icon: 'peso' },
];

export default async function ProgramDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The schedule is secondary, so a failed fetch just hides it.
  const [program, schedule] = await Promise.all([getProgram(slug), listSchedule().catch(() => [])]);
  if (!program) notFound();

  const curated = boardProgramFor(program.name);
  const tagline = curated?.blurb ?? 'Board review program at OBIAS Nursing & Allied Courses Review Center.';
  const batches = schedule
    .filter((b) => b.program.id === program.id)
    .map((b) => ({ ...b, shown: publicBatchStatus(b) }))
    .filter((b) => b.shown !== null);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src="/brands/marketing/resources/hero_healthcare_students.png"
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
        <div className="relative mx-auto max-w-6xl px-6 py-12 text-white sm:py-14">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-white/70">
            <Link href="/offerings" className="hover:text-white">
              Programs
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-white">{program.name}</span>
          </nav>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
            <IconBadge name={curated?.icon ?? 'graduationCap'} className="h-20 w-20" iconClassName="h-10 w-10" />
            <div>
              <h1 className="text-[2.25rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">{program.name}</h1>
              <p className="mt-2 max-w-2xl text-base text-white/85 sm:text-lg">{tagline}</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2.5 rounded-md bg-brand-maroon px-7 py-3 font-heading text-lg font-medium tracking-wide text-white shadow-[0_6px_14px_-4px_rgb(0_0_0/0.4)] transition-colors hover:bg-brand-maroon-dark"
            >
              Enroll Now
              <Icon name="arrowRight" className="h-5 w-5" />
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center rounded-md border-2 border-white/80 px-7 py-3 font-heading text-lg font-medium tracking-wide text-white transition-colors hover:bg-white hover:text-brand-navy"
            >
              View Schedule
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div>
          {/* About */}
          {program.description?.trim() && (
            <section className="mb-12">
              <h2 className="text-[1.6rem] font-extrabold leading-tight text-brand-navy font-sans!">About this Program</h2>
              <div className="mt-4 space-y-3 leading-relaxed text-slate-600 [&_a]:text-brand-maroon [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-brand-navy">
                <ReactMarkdown>{program.description}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* Courses */}
          <section>
            <h2 className="text-[1.6rem] font-extrabold leading-tight text-brand-navy font-sans!">Courses in this Program</h2>
            {program.courses.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Course details are being updated — contact us for the current curriculum.</p>
            ) : (
              <ol className="mt-5 space-y-3">
                {coursesInOrder(program.courses).map((course, i) => (
                  <li key={course.id}>
                    <Link
                      href={`/programs/${program.slug}/courses/${course.id}`}
                      className="group flex items-center gap-5 rounded-xl bg-[#fdf8ee] px-5 py-4 ring-1 ring-[#f1e4c8] transition hover:ring-brand-maroon"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-maroon font-heading text-lg font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-brand-navy">{course.name}</span>
                        <span className="mt-0.5 block text-xs uppercase tracking-wider text-slate-500">{course.code}</span>
                        {course.description && (
                          <span className="mt-1.5 block text-sm leading-snug text-slate-600">{course.description}</span>
                        )}
                      </span>
                      <Icon
                        name="arrowRight"
                        className="h-5 w-5 shrink-0 text-brand-maroon transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Upcoming batches */}
          {batches.length > 0 && (
            <section className="mt-12">
              <h2 className="text-[1.6rem] font-extrabold leading-tight text-brand-navy font-sans!">Upcoming Batches</h2>
              <ul className="mt-5 divide-y divide-slate-200 rounded-xl ring-1 ring-slate-200">
                {batches.map((batch) => (
                  <li key={batch.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="block font-semibold text-brand-navy">{batch.name}</span>
                      <span className="block text-sm text-slate-500">{batch.branch.name}</span>
                    </span>
                    <span className="text-sm text-slate-600">
                      {batch.shown === 'ACTIVE' ? 'In progress · started ' : 'Starts '}
                      {formatDate(batch.startDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl bg-[#fdf1d6] px-6 py-6 ring-1 ring-[#f3e2b8]">
            <h2 className="text-lg font-bold text-brand-navy font-sans!">Why review with Obias?</h2>
            <ul className="mt-4 space-y-3.5">
              {WHY_OBIAS.map((item) => (
                <li key={item.title} className="flex items-center gap-3 text-sm font-medium text-brand-navy">
                  <Icon name={item.icon} className="h-5 w-5 shrink-0 text-brand-maroon" />
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-brand-navy px-6 py-6 text-white">
            <h2 className="text-lg font-bold font-sans!">Have questions?</h2>
            <p className="mt-1.5 text-sm text-white/80">Talk to our team about fees, schedules, and requirements.</p>
            <Link
              href="/contact"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold py-2.5 font-heading text-base font-semibold tracking-wide text-brand-navy transition-colors hover:bg-brand-gold-dark"
            >
              Contact Us
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </div>

      <EnrollBand title={`Ready to review for ${program.name}?`} />
    </div>
  );
}
