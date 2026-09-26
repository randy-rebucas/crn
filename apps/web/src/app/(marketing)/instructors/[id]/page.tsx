import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { excerpt, getInstructor } from '@/lib/public-api';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const instructor = await getInstructor(id);
  if (!instructor) return { title: 'Instructor' };
  const name = `${instructor.user.firstName} ${instructor.user.lastName}`;
  const summary = [instructor.specialization, instructor.bio && excerpt(instructor.bio, 120)].filter(Boolean).join(' — ');
  return {
    title: name,
    description: summary || `${name}, review instructor at OBIAS Nursing & Allied Courses Review Center.`,
  };
}

export default async function InstructorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getInstructor(id);
  if (!instructor) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/instructors" className="text-sm text-brand-maroon hover:underline">
        ← Back to instructors
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold text-slate-900">
        {instructor.user.firstName} {instructor.user.lastName}
      </h1>
      {instructor.specialization && <p className="mt-2 text-sm font-medium text-brand-maroon">{instructor.specialization}</p>}
      {instructor.bio && <p className="mt-4 text-slate-600">{instructor.bio}</p>}
    </div>
  );
}
