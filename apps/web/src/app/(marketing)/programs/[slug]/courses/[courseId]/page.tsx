import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProgram } from '@/lib/public-api';

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

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href={`/programs/${program.slug}`} className="text-sm text-brand-maroon hover:underline">
        ← Back to {program.name}
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold text-slate-900">{course.name}</h1>
      <p className="mt-1 text-sm text-slate-500">{course.code} · part of {program.name}</p>
      {course.description && <p className="mt-4 text-slate-600">{course.description}</p>}

      <div className="mt-12 rounded-xl bg-brand-gold/20 p-8 text-center">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Ready to enroll in {course.name}?</h2>
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
