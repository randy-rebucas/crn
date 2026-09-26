// /programs belongs to the staff dashboard, so the public program list lives
// at /offerings. Announcements are presented to visitors as the "Blog".
export const HEADER_NAV = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Programs', href: '/offerings' },
  { label: 'Reviews', href: '/success-stories' },
  { label: 'Blog', href: '/announcements' },
  { label: 'Contact', href: '/contact' },
];

// Everything the site publishes; the header keeps to the top-level subset.
export const SITE_NAV = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Programs', href: '/offerings' },
  { label: 'Reviews', href: '/success-stories' },
  { label: 'Blog', href: '/announcements' },
  { label: 'Contact', href: '/contact' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Instructors', href: '/instructors' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Visit Us', href: '/locations' },
];

// `/` only matches itself; every other item also owns its sub-pages.
export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
