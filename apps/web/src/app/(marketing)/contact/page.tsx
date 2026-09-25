import type { Metadata } from 'next';
import { EnrollmentForm } from './enrollment-form';
import { fetchPublicSettings, phonesOf } from '@/lib/public-settings';

export const metadata: Metadata = {
  title: 'Enroll / Apply Now',
  description: 'Submit an enrollment inquiry or contact OBIAS Review Center directly.',
};

export default async function ContactPage() {
  const contact = await fetchPublicSettings();
  const phones = phonesOf(contact);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Enroll / Apply Now</h1>
      <p className="mt-2 max-w-xl text-slate-600">
        Tell us which program you&apos;re interested in and we&apos;ll get back to you, or reach
        us directly using the details below.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-brand-cream p-6">
          <EnrollmentForm />
        </div>

        <div className="text-sm text-slate-600">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Visit or Call Us</h2>
          {!contact.enrollmentOpen && (
            <p className="mt-3 rounded-md border border-brand-gold/60 bg-brand-gold/15 px-3 py-2 text-slate-800">
              Enrollment for the current intake is closed. Send an inquiry and we&apos;ll reach out when the next one opens.
            </p>
          )}
          {contact.address && <p className="mt-3">{contact.address}</p>}
          {phones.length > 0 && (
            <ul className="mt-3 space-y-0.5">
              {phones.map((phone) => (
                <li key={phone}>
                  <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-brand-maroon">
                    {phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {contact.supportEmail && (
            <p className="mt-3">
              <a href={`mailto:${contact.supportEmail}`} className="hover:text-brand-maroon">
                {contact.supportEmail}
              </a>
            </p>
          )}
          {contact.facebookPageName && (
            <p className="mt-3">
              Facebook:{' '}
              {contact.facebookUrl ? (
                <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-maroon">
                  {contact.facebookPageName}
                </a>
              ) : (
                contact.facebookPageName
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
