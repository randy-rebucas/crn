import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Offerings', href: '/offerings' },
  { label: 'Instructors', href: '/instructors' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Branches', href: '/locations' },
  { label: 'Success Stories', href: '/success-stories' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'FAQ', href: '/faq' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-heading text-lg font-bold tracking-wide text-brand-maroon">
            OBIAS Review Center
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-brand-maroon">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/contact"
            className="rounded-md bg-brand-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-brand-maroon-dark"
          >
            Enroll Now
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 bg-brand-navy text-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm">
          <p className="font-heading font-semibold text-white">OBIAS Nursing &amp; Allied Courses Review Center</p>
          <p className="mt-1">Jinyang Bldg. #1, Manila Doctors Access Road, Almanza Uno, Las Piñas City</p>
          <p className="mt-1">
            0917 165 4780 · 0939 126 2602 · 0951 562 4048 · 0923 812 2649
          </p>
          <p className="mt-1">centerofreviewfornursing@gmail.com · Facebook: Obias Nursing &amp; Allied Courses Review Center</p>
          <p className="mt-4 text-xs text-slate-400">
            &copy; {new Date().getFullYear()} OBIAS Nursing &amp; Allied Courses Review Center. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
