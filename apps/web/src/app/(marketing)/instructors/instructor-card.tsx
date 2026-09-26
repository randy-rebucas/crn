import Link from 'next/link';
import { excerpt, type PublicInstructor } from '@/lib/public-api';
import { Icon } from '../icons';

export const fullName = (i: PublicInstructor) => `${i.user.firstName} ${i.user.lastName}`;

// Profiles have no photo, so an initials badge stands in for one.
export function InstructorAvatar({ instructor, className = 'h-20 w-20 text-2xl' }: {
  instructor: PublicInstructor;
  className?: string;
}) {
  const initials = `${instructor.user.firstName[0] ?? ''}${instructor.user.lastName[0] ?? ''}`.toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-brand-maroon font-heading font-semibold tracking-wide text-white ${className}`}
    >
      <span className="absolute inset-[3px] rounded-full border-[1.5px] border-white/85" />
      {initials}
    </span>
  );
}

export function InstructorCard({ instructor }: { instructor: PublicInstructor }) {
  return (
    <article className="group relative flex flex-col items-center rounded-xl bg-[#fdf8ee] px-6 pb-6 pt-7 text-center ring-1 ring-[#f1e4c8] shadow-[0_2px_8px_-4px_rgb(15_30_61/0.12)] transition hover:ring-brand-maroon/50">
      <InstructorAvatar instructor={instructor} />
      <h2 className="mt-4 text-lg font-bold text-brand-navy font-sans!">
        {/* The stretched link makes the whole card clickable. */}
        <Link href={`/instructors/${instructor.id}`} className="after:absolute after:inset-0">
          {fullName(instructor)}
        </Link>
      </h2>
      {instructor.specialization && (
        <p className="mt-1 text-sm font-medium text-brand-maroon">{instructor.specialization}</p>
      )}
      {instructor.bio && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{excerpt(instructor.bio, 200)}</p>
      )}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 font-heading text-[0.95rem] font-semibold tracking-wide text-brand-maroon group-hover:text-brand-maroon-dark">
        View Profile
        <Icon name="arrowRight" className="h-4 w-4" />
      </span>
    </article>
  );
}
