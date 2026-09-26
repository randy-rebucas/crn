import type { MetadataRoute } from 'next';
import { listAnnouncements, listInstructors, listPrograms } from '@/lib/public-api';
import { SITE_URL } from '@/lib/site-url';

export const revalidate = 3600;

const STATIC_PATHS = [
  '/',
  '/about',
  '/offerings',
  '/schedule',
  '/instructors',
  '/success-stories',
  '/announcements',
  '/faq',
  '/locations',
  '/contact',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A partial sitemap beats a failed one; dynamic entries return on the next
  // revalidation once the API answers.
  const [programs, instructors, announcements] = await Promise.all([
    listPrograms().catch(() => []),
    listInstructors().catch(() => []),
    listAnnouncements().catch(() => []),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...programs.flatMap((program) => [
      { url: `${SITE_URL}/programs/${program.slug}` },
      ...program.courses.map((course) => ({ url: `${SITE_URL}/programs/${program.slug}/courses/${course.id}` })),
    ]),
    ...instructors.map((instructor) => ({ url: `${SITE_URL}/instructors/${instructor.id}` })),
    ...announcements.map((a) => ({
      url: `${SITE_URL}/announcements/${a.id}`,
      lastModified: a.publishedAt ?? a.createdAt,
    })),
  ];
}
