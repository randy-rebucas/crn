'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { HEADER_NAV, SITE_NAV, isActive } from './nav-items';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="OBIAS Nursing & Allied Courses Review Center — home">
      <Image
        src="/obias_crn_logo_transparent.png"
        alt=""
        width={311}
        height={236}
        className="h-10 w-auto sm:h-12"
        priority
      />
      <span className="flex flex-col">
        <span className="font-heading text-[1.6rem] font-bold leading-[0.9] tracking-wide text-brand-maroon sm:text-[1.9rem]">
          OBIAS
        </span>
        <span className="mt-1 text-[0.55rem] font-bold uppercase leading-[1.15] text-brand-navy sm:text-[0.6rem]">
          Nursing &amp; Allied Courses
          <br />
          Review Center
        </span>
      </span>
    </Link>
  );
}

// The only interactive part of the marketing shell, kept client-side so the
// layout itself can render on the server.
export function SiteHeader() {
  const pathname = usePathname();
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
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgb(15_30_61/0.08)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-2 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-9 text-[0.8125rem] font-medium text-brand-navy lg:flex">
          {HEADER_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative py-2 transition-colors hover:text-brand-maroon ${
                  active
                    ? 'text-brand-maroon after:absolute after:inset-x-0 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-maroon'
                    : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-brand-maroon px-3.5 py-2 font-heading text-sm font-medium tracking-wide text-white shadow-[0_2px_6px_-1px_rgb(107_20_31/0.35)] transition-colors hover:bg-brand-maroon-dark sm:px-5 sm:py-2.5 sm:text-base"
          >
            Enroll Now
            <Icon name="arrowRight" className="hidden h-4 w-4 sm:block" />
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
        <nav id="marketing-mobile-nav" aria-label="Main" className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6 lg:hidden">
          <ul className="grid grid-cols-2 gap-1">
            {SITE_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`block rounded-md px-2 py-2.5 text-sm font-medium hover:bg-brand-cream hover:text-brand-maroon ${
                      active ? 'text-brand-maroon' : 'text-brand-navy'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

// The footer's closing link row; client-side only to mark the current page.
export function FooterNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Footer">
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-brand-navy sm:justify-start">
        {SITE_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`transition-colors hover:text-brand-maroon ${active ? 'text-brand-maroon' : ''}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
