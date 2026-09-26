import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { coursesInOrder, getProgram } from '@/lib/public-api';
import { EnrollBand } from '../../../../enroll-band';
import { Icon, IconBadge } from '../../../../icons';
import { boardProgramFor } from '../../../../offerings/board-programs';

type PageParams = { slug: string; courseId: string };

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug, courseId } = await params;
  const program = await getProgram(slug);
  const course = program?.courses.find((c) => c.id === courseId);
  return { title: course?.name ?? 'Course', description: course?.description ?? undefined };
}

export default async function CourseDetailsPage({ params }: { params: Promise<PageParams> }) {
  const { slug, courseId } = await params;
  const program = await getProgram(slug);
  const course = program?.courses.find((c) => c.id === courseId);
  if (!program || !course) notFound();

  const icon = boardProgramFor(program.name)?.icon ?? 'graduationCap';
  const courses = coursesInOrder(program.courses);
  const position = courses.findIndex((c) => c.id === course.id) + 1;

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-navy">
        <div className="mx-auto max-w-6xl px-6 py-12 text-white sm:py-14">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-white/70">
            <Link href="/offerings" className="hover:text-white">
              Programs
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={`/programs/${program.slug}`} className="hover:text-white">
              {program.name}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-white">{course.name}</span>
          </nav>
          <p className="mt-6 inline-block rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-navy">
            {course.code}
          </p>
          <h1 className="mt-3 max-w-3xl text-[2.1rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-[2.75rem]">
            {course.name}
          </h1>
          <p className="mt-2 text-white/80">
            Course {position} of {program.courses.length} in the {program.name} program
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[1fr_20rem] lg:gap-12">
        {/* About the course */}
        <section>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-brand-navy font-sans!">About this Course</h2>
          {course.description?.trim() ? (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{course.description}</p>
          ) : (
            <p className="mt-4 leading-relaxed text-slate-600">
              This course is part of our {program.name} review program. Contact us for the full course outline,
              schedule, and fees.
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2.5 rounded-md bg-brand-maroon px-7 py-3 font-heading text-lg font-medium tracking-wide text-white shadow-[0_6px_14px_-4px_rgb(107_20_31/0.45)] transition-colors hover:bg-brand-maroon-dark"
            >
              Enroll Now
              <Icon name="arrowRight" className="h-5 w-5" />
            </Link>
            <Link
              href={`/programs/${program.slug}`}
              className="inline-flex items-center rounded-md border-2 border-brand-maroon px-7 py-3 font-heading text-lg font-medium tracking-wide text-brand-navy transition-colors hover:bg-brand-maroon hover:text-white"
            >
              View Program
            </Link>
          </div>
        </section>

        {/* Other courses in the program */}
        <aside className="rounded-xl bg-[#fdf8ee] px-6 py-6 ring-1 ring-[#f1e4c8] lg:self-start">
          <div className="flex items-center gap-3">
            <IconBadge name={icon} className="h-12 w-12" iconClassName="h-6 w-6" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Program</p>
              <Link href={`/programs/${program.slug}`} className="font-bold text-brand-navy hover:text-brand-maroon">
                {program.name}
              </Link>
            </div>
          </div>
          <ol className="mt-5 space-y-1">
            {courses.map((c, i) => {
              const current = c.id === course.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/programs/${program.slug}/courses/${c.id}`}
                    aria-current={current ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      current ? 'bg-brand-maroon text-white' : 'text-brand-navy hover:bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        current ? 'bg-white text-brand-maroon' : 'bg-brand-maroon text-white'
                      }`}
                    >
                      {i + 1}
                    </span>
                    {c.name}
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <EnrollBand title={`Ready to enroll in ${course.name}?`} />
    </div>
  );
}
