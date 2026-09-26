import Image from 'next/image';
import QRCode from 'qrcode';
import { fetchPublicSettings, phonesOf } from '@/lib/public-settings';
import { Icon } from './icons';
import { FooterNav, SiteHeader } from './site-header';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Contact block comes from Settings; fetchPublicSettings falls back to the
  // center's real details if the API is down, so this never renders empty.
  const contact = await fetchPublicSettings();
  // The walk-in "SCAN ME" code points at the Facebook page, so it only exists
  // once an admin has set that URL.
  const facebookQr = contact.facebookUrl
    ? await QRCode.toString(contact.facebookUrl, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f1e3d', light: '#ffffff' },
      }).catch(() => null)
    : null;

  return (
    // Explicit light surface: the root stylesheet switches the body to a dark
    // background under prefers-color-scheme, which this site doesn't support.
    <div className="marketing-site flex flex-1 flex-col bg-white text-slate-900">
      <SiteHeader />

      <main className="flex-1">{children}</main>

      <footer className="bg-brand-navy text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-y-8 px-6 py-9 sm:grid-cols-2 lg:grid-cols-[1.05fr_0.95fr_1.5fr_1.15fr] lg:divide-x lg:divide-white/15">
          <div className="lg:pr-7">
            <div className="flex items-center gap-2.5">
              <Image
                src="/obias_crn_logo_transparent.png"
                alt=""
                width={311}
                height={236}
                className="h-14 w-auto brightness-0 invert"
              />
              <div>
                <p className="font-heading text-[2rem] font-bold leading-[0.9] tracking-wide">OBIAS</p>
                <p className="mt-1 text-[0.6rem] font-bold uppercase leading-[1.2] text-white/90">
                  Nursing &amp; Allied Courses
                  <br />
                  Review Center
                </p>
              </div>
            </div>
            <p className="mt-5 flex items-center gap-2 text-[0.8125rem] font-semibold">
              Your Success is Our Mission!
              <Icon name="heartbeat" className="h-7 w-14 shrink-0 text-white" />
            </p>
          </div>

          <div className="lg:px-7">
            <h2 className="text-base font-semibold font-sans!">Get in Touch</h2>
            <div className="mt-3 flex items-start gap-3">
              <Icon name="phone" className="mt-1 h-6 w-6 shrink-0" />
              <ul className="font-heading text-xl font-semibold leading-snug tracking-wide">
                {phonesOf(contact).map((phone) => (
                  <li key={phone}>
                    <a href={`tel:${phone.replace(/\s+/g, '')}`} className="transition-colors hover:text-brand-gold">
                      {phone}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:px-7">
            {contact.address && (
              <div className="flex items-start gap-3">
                <Icon name="mapPin" className="mt-0.5 h-6 w-6 shrink-0 text-[#e5484d]" />
                <div>
                  <h2 className="text-sm font-semibold font-sans!">Main Center:</h2>
                  <p className="mt-1 text-xs uppercase leading-relaxed text-white/85">{contact.address}</p>
                </div>
              </div>
            )}
            <h2 className="mt-4 text-sm font-semibold font-sans!">Connect With Us:</h2>
            <ul className="mt-2 space-y-2 text-xs text-white/90">
              {contact.facebookPageName && (
                <li className="flex items-center gap-2.5">
                  <Icon name="facebook" className="h-5 w-5 shrink-0" />
                  {contact.facebookUrl ? (
                    <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-gold">
                      {contact.facebookPageName}
                    </a>
                  ) : (
                    <span>{contact.facebookPageName}</span>
                  )}
                </li>
              )}
              {contact.supportEmail && (
                <li className="flex items-center gap-2.5">
                  <Icon name="mail" className="h-5 w-5 shrink-0" />
                  <a href={`mailto:${contact.supportEmail}`} className="break-all hover:text-brand-gold">
                    {contact.supportEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="flex items-center gap-4 lg:pl-7">
            {facebookQr && (
              <div className="w-[104px] shrink-0 rounded-md bg-white p-2 text-center">
                <div
                  role="img"
                  aria-label="QR code linking to our Facebook page"
                  className="aspect-square [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: facebookQr }}
                />
                <p className="mt-1.5 rounded-sm bg-brand-navy py-0.5 font-heading text-[0.7rem] font-semibold uppercase tracking-wider text-white">
                  Scan me!
                </p>
              </div>
            )}
            <div className="text-xs leading-relaxed text-white/85">
              <p>Follow us on Facebook for updates and announcements!</p>
              {contact.facebookUrl ? (
                <a
                  href={contact.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open our Facebook page"
                  className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded bg-[#1877f2] text-white transition hover:brightness-110"
                >
                  <Icon name="facebook" className="h-4 w-4" />
                </a>
              ) : (
                <span className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded bg-[#1877f2] text-white">
                  <Icon name="facebook" className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-4 lg:flex-row lg:justify-between">
            <FooterNav />
            <p className="text-center text-[0.6875rem] text-brand-navy/80">
              &copy; {new Date().getFullYear()} Obias Nursing &amp; Allied Courses Review Center. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
