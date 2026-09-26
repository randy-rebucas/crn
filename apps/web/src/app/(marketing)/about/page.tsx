import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchPublicSettings } from '@/lib/public-settings';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    '20+ years preparing nursing and allied-health graduates for their board licensure exams in Las Piñas City.',
};

export default async function AboutPage() {
  const { address } = await fetchPublicSettings();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">About OBIAS</h1>
      <p className="mt-4 text-slate-600">
        OBIAS Nursing &amp; Allied Courses Review Center has spent over 20 years preparing nursing
        and allied-health graduates for their licensure exams, producing thousands of successful
        reviewees who now serve the community as healthcare professionals.
      </p>
      <p className="mt-4 text-slate-600">
        Our reviewers are experienced healthcare professionals and educators, and our review
        materials are built around what candidates actually need to pass — not just cover — their
        board exam.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold text-slate-900">Our Mission</h2>
      <p className="mt-2 text-slate-600">&ldquo;Your Success Is Our Mission!&rdquo;</p>

      {address && (
        <>
          <h2 className="mt-10 font-heading text-xl font-semibold text-slate-900">Visit Us</h2>
          <p className="mt-2 text-slate-600">{address}</p>
          <Link href="/locations" className="mt-2 inline-block text-sm font-semibold text-brand-maroon hover:underline">
            Directions &amp; contact numbers &rarr;
          </Link>
        </>
      )}

      <div className="mt-10">
        <Link
          href="/contact"
          className="inline-block rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          Enroll / Apply Now
        </Link>
      </div>
    </div>
  );
}
