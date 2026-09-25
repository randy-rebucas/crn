'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api-client';
import { PUBLIC_SETTINGS_FALLBACK, phonesOf, withFallbacks, type PublicSettings } from '@/lib/public-settings';

const NAV_ITEMS = [
  { label: 'About', href: '/about' },
  { label: 'Programs', href: '/programs' },
  { label: 'Reviews', href: '/success-stories' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/obias_crn_logo_transparent.png"
        alt="OBIAS Nursing &amp; Allied Courses Review Center"
        width={44}
        height={36}
        className="h-9 w-auto"
        priority
      />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-lg font-bold tracking-wide text-brand-maroon">OBIAS</span>
        <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-brand-navy">
          Nursing &amp; Allied Courses Review Center
        </span>
      </span>
    </Link>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Contact block comes from Settings; the fallback keeps it filled while
  // loading or if the API is down.
  const { data: contact = PUBLIC_SETTINGS_FALLBACK } = useQuery<PublicSettings>({
    queryKey: ['public', 'settings'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/v1/public/settings`);
      if (!res.ok) throw new Error('settings unavailable');
      return withFallbacks(await res.json());
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-brand-maroon">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/contact"
              className="inline-flex rounded-md bg-brand-maroon px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-maroon-dark sm:px-4 sm:text-sm"
            >
              Enroll Now
            </Link>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="marketing-mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-brand-maroon lg:hidden"
            >
              <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="marketing-mobile-nav" className="border-t border-slate-200 bg-white px-6 py-4 lg:hidden">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-2 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-cream hover:text-brand-maroon"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="mt-3 block rounded-md bg-brand-maroon px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-maroon-dark"
            >
              Enroll Now
            </Link>
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-brand-navy text-slate-200">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-3">
          <div>
            <h2 className="font-heading text-2xl font-bold text-white">Get in Touch</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-300">
              Have questions about enrollment or our programs? Reach us any of these ways.
            </p>
            <ul className="mt-6 space-y-3 text-base font-semibold text-white">
              {phonesOf(contact).map((phone) => (
                <li key={phone}>
                  <a href={`tel:${phone.replace(/\s+/g, '')}`} className="transition-colors hover:text-brand-gold">
                    {phone}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-heading text-sm font-bold uppercase tracking-[0.14em] text-white">Explore</h2>
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-slate-300">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-brand-gold">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-brand-navy-light p-6">
            {contact.address && (
              <div className="flex items-start gap-3">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true">
                  <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
                  <circle cx={12} cy={9.5} r={2.4} stroke="currentColor" strokeWidth={1.8} />
                </svg>
                <p className="text-sm text-slate-200">{contact.address}</p>
              </div>
            )}
            {contact.supportEmail && (
              <div className="mt-3 flex items-start gap-3">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true">
                  <rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke="currentColor" strokeWidth={1.8} />
                  <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
                </svg>
                <a href={`mailto:${contact.supportEmail}`} className="break-all text-sm text-slate-200 hover:text-brand-gold">
                  {contact.supportEmail}
                </a>
              </div>
            )}
            {contact.facebookPageName && (
              <div className="mt-3 flex items-start gap-3">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true">
                  <path d="M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2.5H8V14h2.5v6.5H14V14h2.5l.5-3.5h-3V8Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
                </svg>
                {contact.facebookUrl ? (
                  <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-200 hover:text-brand-gold">
                    Facebook: {contact.facebookPageName}
                  </a>
                ) : (
                  <p className="text-sm text-slate-200">Facebook: {contact.facebookPageName}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <Image
                src="/obias_crn_logo_transparent.png"
                alt="OBIAS Nursing &amp; Allied Courses Review Center"
                width={40}
                height={32}
                className="h-8 w-auto"
              />
              <span className="font-heading text-sm font-bold uppercase tracking-wide text-brand-maroon">
                OBIAS Review Center
              </span>
            </div>
            <p className="font-script text-2xl text-brand-maroon">Your Success Is Our Mission!</p>
          </div>
        </div>

        <div className="bg-brand-maroon">
          <p className="mx-auto max-w-6xl px-6 py-3 text-center text-xs text-white/80 sm:text-left">
            &copy; {new Date().getFullYear()} OBIAS Nursing &amp; Allied Courses Review Center. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
