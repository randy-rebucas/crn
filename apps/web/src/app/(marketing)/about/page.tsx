import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    '20+ years preparing nursing and allied-health graduates for their board licensure exams in Las Piñas City.',
};

export default function AboutPage() {
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

      <h2 className="mt-10 font-heading text-xl font-semibold text-slate-900">Visit Us</h2>
      <p className="mt-2 text-slate-600">
        Jinyang Bldg. #1, Manila Doctors Access Road, Almanza Uno, Las Piñas City
      </p>

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
