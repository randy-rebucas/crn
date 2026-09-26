import type { Metadata } from 'next';
import Image from 'next/image';
import { listBranches } from '@/lib/public-api';
import { fetchPublicSettings, phonesOf } from '@/lib/public-settings';
import { EnrollBand } from '../enroll-band';
import { Icon } from '../icons';
import { EmailLink, InfoRow, PhoneList } from '../info-row';

export const metadata: Metadata = {
  title: 'Visit Us',
  description: 'Visit OBIAS Nursing & Allied Courses Review Center in Almanza Uno, Las Piñas City.',
};

const mapsSearch = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export default async function VisitUsPage() {
  // The center is a single location, so its address comes from Settings.
  // Branch records are only listed if more than one is ever activated; they
  // are secondary here, so an API hiccup just hides them.
  const [contact, branches] = await Promise.all([fetchPublicSettings(), listBranches().catch(() => [])]);
  const phones = phonesOf(contact);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src="/brands/marketing/resources/hero_people_studying.png"
          alt=""
          width={824}
          height={428}
          priority
          sizes="60vw"
          className="absolute bottom-0 right-0 w-[min(62vw,760px)] opacity-30 grayscale-[30%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--brand-navy)_0%,rgb(15_30_61/0.9)_45%,rgb(15_30_61/0.5)_100%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-14 text-white sm:py-16">
          <h1 className="text-[2.5rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">Visit Us</h1>
          <p className="mt-3 max-w-2xl text-base text-white/85 sm:text-lg">
            Walk in to ask about programs, schedules, or to enroll in person.
          </p>
        </div>
      </section>

      {/* Main center */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-14 lg:grid-cols-[22rem_1fr] lg:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-maroon">Main Center</p>
          <h2 className="mt-2 text-[1.6rem] font-extrabold leading-tight text-brand-navy font-sans!">{contact.organizationName}</h2>
          <div className="mt-7 flex flex-col gap-7">
            {contact.address && (
              <InfoRow icon="mapPin" title="Address">
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
          </div>
          {contact.address && (
            <a
              href={mapsSearch(contact.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2.5 rounded-md bg-brand-maroon px-7 py-3 font-heading text-lg font-medium tracking-wide text-white shadow-[0_6px_14px_-4px_rgb(107_20_31/0.45)] transition-colors hover:bg-brand-maroon-dark"
            >
              Get Directions
              <Icon name="arrowRight" className="h-5 w-5" />
            </a>
          )}
        </div>

        {contact.address && (
          <iframe
            title="Map to OBIAS Review Center"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(contact.address)}&z=16&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="min-h-[24rem] w-full rounded-xl border-0 ring-1 ring-slate-200 shadow-[0_10px_30px_-12px_rgb(15_30_61/0.35)] lg:min-h-[30rem]"
          />
        )}
      </section>

      {/* Other branches, only once more than one is active */}
      {branches.length > 1 && (
        <section className="bg-[#fdf8ee]">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
            <h2 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.01em] text-brand-navy font-sans! sm:text-[2rem]">
              All Locations
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((branch) => (
                <div key={branch.id} className="flex flex-col rounded-xl bg-white px-6 py-5 ring-1 ring-[#f1e4c8]">
                  <div className="flex items-center gap-3">
                    <Icon name="mapPin" className="h-6 w-6 shrink-0 text-brand-maroon" />
                    <h3 className="font-bold text-brand-navy font-sans!">{branch.name}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {branch.address ?? 'Call us for directions to this branch.'}
                  </p>
                  {branch.address && (
                    <a
                      href={mapsSearch(branch.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1.5 pt-4 font-heading text-[0.95rem] font-semibold tracking-wide text-brand-maroon hover:text-brand-maroon-dark"
                    >
                      Get Directions
                      <Icon name="arrowRight" className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <EnrollBand
        title="Can't visit yet?"
        subtitle="Send us an inquiry and our team will get back to you."
        cta="Send an Inquiry"
      />
    </div>
  );
}
