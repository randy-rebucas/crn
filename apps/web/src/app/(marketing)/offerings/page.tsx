import type { Metadata } from 'next';
import Link from 'next/link';
import { listPrograms } from '@/lib/public-api';
import { ADDITIONAL_OFFERINGS } from './additional-offerings';

export const metadata: Metadata = {
  title: 'Programs & Offerings',
  description:
    'Review programs for Nursing, Midwifery, Medical Technology, and Physical Therapy, plus seminars, caregiving, and language courses.',
};

export default async function OfferingsPage() {
  const programs = await listPrograms();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Programs &amp; Offerings</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Review programs for board licensure, plus additional courses for healthcare careers.
      </p>

      <h2 className="mt-12 font-heading text-xl font-semibold text-slate-900">Review Programs</h2>
      {programs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Program details are being updated — please check back soon, or contact us directly.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {programs.map((program) => (
            <Link
              key={program.id}
              href={`/programs/${program.slug}`}
              className="rounded-xl border border-slate-200 bg-brand-cream p-6 transition hover:border-brand-maroon"
            >
              <h3 className="font-heading font-semibold text-slate-900">{program.name}</h3>
              {program.description && <p className="mt-2 text-sm text-slate-600">{program.description}</p>}
              {program.courses.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  {program.courses.map((course) => (
                    <li key={course.id}>
                      {course.name} ({course.code})
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mt-12 font-heading text-xl font-semibold text-slate-900">Additional Offerings</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {ADDITIONAL_OFFERINGS.map((offering) => (
          <div key={offering.name} className="rounded-xl border border-slate-200 bg-brand-cream p-6">
            <h3 className="font-heading font-semibold text-slate-900">{offering.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{offering.blurb}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl bg-brand-gold/20 p-8 text-center">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Ready to start your review?</h2>
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
