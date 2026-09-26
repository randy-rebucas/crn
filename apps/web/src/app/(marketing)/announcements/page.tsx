import type { Metadata } from 'next';
import Image from 'next/image';
import { listAnnouncements } from '@/lib/public-api';
import { AnnouncementCard } from './announcement-card';

export const metadata: Metadata = {
  title: 'News & Articles',
  description: 'Latest news, announcements, and tips from OBIAS Nursing & Allied Courses Review Center.',
};

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy">
        <Image
          src="/brands/marketing/resources/hero_healthcare_students.png"
          alt=""
          width={798}
          height={445}
          priority
          sizes="60vw"
          className="absolute bottom-0 right-0 w-[min(62vw,760px)] opacity-30 grayscale-[30%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,var(--brand-navy)_0%,rgb(15_30_61/0.9)_45%,rgb(15_30_61/0.5)_100%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-14 text-white sm:py-16">
          <h1 className="text-[2.5rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-5xl">Latest News &amp; Articles</h1>
          <p className="mt-3 max-w-2xl text-base text-white/85 sm:text-lg">
            Tips, updates, and insights for future healthcare professionals.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
        {announcements.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No news posted yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {announcements.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
