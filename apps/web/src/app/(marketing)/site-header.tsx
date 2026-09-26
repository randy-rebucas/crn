'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HEADER_NAV, SITE_NAV } from './nav-items';

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

// The only interactive part of the marketing shell, kept client-side so the
// layout itself can render on the server.
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
          {HEADER_NAV.map((item) => (
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav id="marketing-mobile-nav" className="border-t border-slate-200 bg-white px-6 py-4 lg:hidden">
          <ul className="flex flex-col gap-1">
            {SITE_NAV.map((item) => (
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
  );
}
