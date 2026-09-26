import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

// The staff dashboard's routes sit at the top level (the (dashboard) group
// adds no prefix), so they are listed one by one. Keep in sync with
// src/app/(dashboard). These pages require login anyway; this just keeps
// crawlers from spending time on login redirects.
const PRIVATE_PATHS = [
  '/admissions',
  '/attendance',
  '/audit-logs',
  '/branches',
  '/classes',
  '/content',
  '/courses',
  '/curriculum',
  '/dashboard',
  '/enrollments',
  '/exams',
  '/finance',
  '/leads',
  '/notifications',
  '/permissions',
  '/programs$', // the dashboard list; public program pages live under /programs/<slug>
  '/reports',
  '/results',
  '/roles',
  '/schedules',
  '/settings',
  '/staff',
  '/student', // also covers /students
  '/instructor$', // not a bare prefix: /instructors is public
  '/instructor/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
