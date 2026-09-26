import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { excerpt, getInstructor, listInstructors } from '@/lib/public-api';
import { EnrollBand } from '../../enroll-band';
import { Icon } from '../../icons';
import { InstructorAvatar, InstructorCard, fullName } from '../instructor-card';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const instructor = await getInstructor(id);
  if (!instructor) return { title: 'Instructor' };
  const name = fullName(instructor);
  const summary = [instructor.specialization, instructor.bio && excerpt(instructor.bio, 120)].filter(Boolean).join(' — ');
  return {
    title: name,
    description: summary || `${name}, review instructor at OBIAS Nursing & Allied Courses Review Center.`,
  };
}

export default async function InstructorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Other instructors are secondary, so a failed list just hides them.
  const [instructor, all] = await Promise.all([getInstructor(id), listInstructors().catch(() => [])]);
  if (!instructor) notFound();
  const others = all.filter((i) => i.id !== instructor.id).slice(0, 3);
  const name = fullName(instructor);

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-navy">
        <div className="mx-auto max-w-6xl px-6 py-12 text-white sm:py-14">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-white/70">
            <Link href="/instructors" className="hover:text-white">
              Instructors
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-white">{name}</span>
          </nav>
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
            <span className="self-start rounded-full bg-brand-gold p-1.5 sm:self-auto">
              <InstructorAvatar instructor={instructor} className="h-28 w-28 text-4xl" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">Review Instructor</p>
              <h1 className="mt-2 text-[2.25rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">{name}</h1>
              {instructor.specialization && <p className="mt-2 text-lg text-white/85">{instructor.specialization}</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <section>
          <h2 className="text-[1.6rem] font-extrabold leading-tight text-brand-navy font-sans!">About {instructor.user.firstName}</h2>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">
            {instructor.bio?.trim() ||
              `${name} is a review instructor at OBIAS Nursing & Allied Courses Review Center, helping reviewees prepare for their board licensure exams.`}
          </p>
        </section>

        <aside className="rounded-xl bg-[#fdf1d6] px-6 py-6 ring-1 ring-[#f3e2b8] lg:self-start">
          <h2 className="text-lg font-bold text-brand-navy font-sans!">Review with our instructors</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Explore our board review programs, or ask us about class schedules.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Link
              href="/offerings"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-maroon py-2.5 font-heading text-base font-medium tracking-wide text-white transition-colors hover:bg-brand-maroon-dark"
            >
              View Programs
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center rounded-md border-2 border-brand-maroon py-2 font-heading text-base font-medium tracking-wide text-brand-navy transition-colors hover:bg-brand-maroon hover:text-white"
            >
              View Schedule
            </Link>
          </div>
        </aside>
      </div>

      {others.length > 0 && (
        <section className="bg-[#f6f7f9]">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
            <h2 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.01em] text-brand-navy font-sans!">
              Other Instructors
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((other) => (
                <InstructorCard key={other.id} instructor={other} />
              ))}
            </div>
          </div>
        </section>
      )}

      <EnrollBand />
    </div>
  );
}
