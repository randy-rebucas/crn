// Public origin of the marketing site, used for canonical/Open Graph URLs,
// the sitemap, and robots.txt. Set NEXT_PUBLIC_SITE_URL in each deployment.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
