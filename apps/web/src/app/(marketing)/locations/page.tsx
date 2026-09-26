import type { Metadata } from 'next';
import Link from 'next/link';
import { listBranches } from '@/lib/public-api';
import { fetchPublicSettings, phonesOf } from '@/lib/public-settings';

export const metadata: Metadata = {
  title: 'Visit Us',
  description: 'Visit OBIAS Nursing & Allied Courses Review Center in Almanza Uno, Las Piñas City.',
};

export default async function VisitUsPage() {
  // The center is a single location, so its address comes from Settings.
  // Branch records are only listed if more than one is ever activated; they
  // are secondary here, so an API hiccup just hides them.
  const [contact, branches] = await Promise.all([fetchPublicSettings(), listBranches().catch(() => [])]);
  const phones = phonesOf(contact);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Visit Us</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Walk in to ask about programs, schedules, or to enroll in person.</p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-brand-cream p-6">
        <h2 className="font-heading font-semibold text-slate-900">{contact.organizationName}</h2>
        {contact.address && (
          <>
            <p className="mt-2 text-sm text-slate-600">{contact.address}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-brand-maroon hover:underline"
            >
              Open in Google Maps &rarr;
            </a>
          </>
        )}
        {phones.length > 0 && (
          <ul className="mt-4 space-y-0.5 text-sm text-slate-600">
            {phones.map((phone) => (
              <li key={phone}>
                <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-brand-maroon">
                  {phone}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {branches.length > 1 && (
        <>
          <h2 className="mt-12 font-heading text-xl font-semibold text-slate-900">All locations</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {branches.map((branch) => (
              <div key={branch.id} className="rounded-xl border border-slate-200 bg-brand-cream p-6">
                <h3 className="font-heading font-semibold text-slate-900">{branch.name}</h3>
                {branch.address && <p className="mt-2 text-sm text-slate-600">{branch.address}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-12 rounded-xl bg-brand-gold/20 p-8 text-center">
        <h2 className="font-heading text-lg font-semibold text-slate-900">Can&apos;t visit yet?</h2>
        <Link
          href="/contact"
          className="mt-4 inline-block rounded-md bg-brand-maroon px-6 py-3 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
        >
          Send an Inquiry
        </Link>
      </div>
    </div>
  );
}
