import type { Metadata } from 'next';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api-client';

export const metadata: Metadata = {
  title: 'Our Instructors',
  description: 'Meet the experienced review instructors at OBIAS Nursing & Allied Courses Review Center.',
};

interface PublicInstructor {
  id: string;
  bio: string | null;
  specialization: string | null;
  user: { firstName: string; lastName: string };
}

async function getInstructors(): Promise<PublicInstructor[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/instructors`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function InstructorsPage() {
  const instructors = await getInstructors();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Meet Our Instructors</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Experienced review instructors dedicated to your success.</p>

      {instructors.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Instructor profiles are being updated — please check back soon.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map((instructor) => (
            <Link
              key={instructor.id}
              href={`/instructors/${instructor.id}`}
              className="rounded-xl border border-slate-200 bg-brand-cream p-6 transition hover:border-brand-maroon"
            >
              <h2 className="font-heading font-semibold text-slate-900">
                {instructor.user.firstName} {instructor.user.lastName}
              </h2>
              {instructor.specialization && <p className="mt-1 text-xs text-brand-maroon">{instructor.specialization}</p>}
              {instructor.bio && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{instructor.bio}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
