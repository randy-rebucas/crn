import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api-client';

interface PublicInstructor {
  id: string;
  bio: string | null;
  specialization: string | null;
  user: { firstName: string; lastName: string };
}

async function getInstructor(id: string): Promise<PublicInstructor | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/instructors/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const instructor = await getInstructor(id);
  return { title: instructor ? `${instructor.user.firstName} ${instructor.user.lastName}` : 'Instructor' };
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
