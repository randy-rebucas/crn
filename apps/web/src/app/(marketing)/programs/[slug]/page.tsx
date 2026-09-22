import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api-client';

interface PublicCourse {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

interface PublicProgram {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  courses: PublicCourse[];
}

async function getProgram(slug: string): Promise<PublicProgram | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/programs/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  return { title: program?.name ?? 'Program', description: program?.description ?? undefined };
}

export default async function ProgramDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/offerings" className="text-sm text-brand-maroon hover:underline">
        ← Back to programs
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold text-slate-900">{program.name}</h1>
      {program.description && <p className="mt-4 max-w-2xl text-slate-600">{program.description}</p>}

      <h2 className="mt-10 font-heading text-xl font-semibold text-slate-900">Courses</h2>
      {program.courses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Course details are being updated.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {program.courses.map((course) => (
            <Link
              key={course.id}
              href={`/programs/${program.slug}/courses/${course.id}`}
              className="rounded-xl border border-slate-200 bg-brand-cream p-5 transition hover:border-brand-maroon"
            >
              <h3 className="font-heading font-semibold text-slate-900">{course.name}</h3>
              <p className="text-xs text-slate-500">{course.code}</p>
              {course.description && <p className="mt-2 text-sm text-slate-600">{course.description}</p>}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-xl bg-brand-gold/20 p-8 text-center">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Interested in {program.name}?</h2>
        <Link
          href="/contact"
          className="mt-4 inline-block rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          Enroll / Apply Now
        </Link>
      </div>
    </div>
  );
}
