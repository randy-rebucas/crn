import type { Metadata } from 'next';
import Image from 'next/image';
import { EnrollmentForm } from './enrollment-form';
import { ADDITIONAL_OFFERINGS, FALLBACK_REVIEW_PROGRAMS } from '../offerings/additional-offerings';
import { Icon } from '../icons';
import { EmailLink, InfoRow, PhoneList } from '../info-row';
import { listPrograms } from '@/lib/public-api';
import { fetchPublicSettings, phonesOf } from '@/lib/public-settings';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Send an enrollment inquiry or contact OBIAS Review Center directly by phone, email, or Facebook.',
};

const RESOURCES = '/brands/marketing/resources';

export default async function ContactPage() {
  // The inquiry form must stay usable during an API outage, so the program
  // list falls back rather than failing the page.
  const [contact, programs] = await Promise.all([fetchPublicSettings(), listPrograms().catch(() => [])]);
  const phones = phonesOf(contact);
  const reviewPrograms = programs.length > 0 ? programs.map((p) => p.name) : FALLBACK_REVIEW_PROGRAMS;
  const programOptions = [...reviewPrograms, ...ADDITIONAL_OFFERINGS.map((o) => o.name)];
  const mapQuery = contact.address ? encodeURIComponent(contact.address) : null;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src={`${RESOURCES}/hero_people_studying.png`}
          alt=""
          width={824}
          height={428}
          priority
          sizes="100vw"
          className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2 opacity-20 grayscale-[30%]"
        />
        <div className="absolute inset-0 bg-brand-navy/60" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-6 py-12 text-center text-white sm:py-14">
          <h1 className="text-[2.5rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">Get in Touch</h1>
          <p className="mt-3 text-base text-white/85 sm:text-lg">
            We&apos;re here to answer your questions and help you on your journey.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[1fr_1.15fr_1fr] lg:gap-8">
        {/* Contact details */}
        <div className="flex flex-col gap-7 lg:border-r lg:border-slate-200 lg:pr-8">
          {contact.address && (
            <InfoRow icon="mapPin" title="Main Center">
              <p className="uppercase leading-relaxed tracking-wide">{contact.address}</p>
            </InfoRow>
          )}
          {phones.length > 0 && (
            <InfoRow icon="phone" title="Phone Numbers">
              <PhoneList phones={phones} />
            </InfoRow>
          )}
          {contact.supportEmail && (
            <InfoRow icon="mail" title="Email">
              <EmailLink email={contact.supportEmail} />
            </InfoRow>
          )}
          {contact.facebookPageName && (
            <InfoRow icon="facebook" title="Facebook">
              {contact.facebookUrl ? (
                <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-maroon">
                  {contact.facebookPageName}
                </a>
              ) : (
                contact.facebookPageName
              )}
            </InfoRow>
          )}
        </div>

        {/* Inquiry form */}
        <div>
          <h2 className="text-xl font-bold text-brand-navy font-sans!">Send Us a Message</h2>
          {!contact.enrollmentOpen && (
            <p className="mt-3 rounded-md border border-brand-gold/60 bg-brand-gold/15 px-3 py-2 text-sm text-slate-800">
              Enrollment for the current intake is closed. Send an inquiry and we&apos;ll reach out when the next one opens.
            </p>
          )}
          <div className="mt-4">
            <EnrollmentForm programOptions={programOptions} />
          </div>
        </div>

        {/* Map */}
        {mapQuery && (
          <div className="flex flex-col">
            <iframe
              title="Map to OBIAS Review Center"
              src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="min-h-[20rem] w-full flex-1 rounded-xl border-0 ring-1 ring-slate-200 shadow-[0_4px_16px_-8px_rgb(15_30_61/0.18)]"
            />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 self-start font-heading text-[0.95rem] font-semibold tracking-wide text-brand-maroon hover:text-brand-maroon-dark"
            >
              Open in Google Maps
              <Icon name="arrowRight" className="h-4 w-4" />
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
