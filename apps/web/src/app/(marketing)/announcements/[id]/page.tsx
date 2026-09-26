import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { formatDate } from '@/lib/format';
import { excerpt, getAnnouncement, listAnnouncements } from '@/lib/public-api';
import { Icon } from '../../icons';
import { AnnouncementCard, AnnouncementCover } from '../announcement-card';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) return { title: 'Announcement' };
  return { title: announcement.title, description: excerpt(announcement.body) };
}

export default async function AnnouncementDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // "More news" is secondary, so a failed list just hides it.
  const [announcement, all] = await Promise.all([getAnnouncement(id), listAnnouncements().catch(() => [])]);
  if (!announcement) notFound();
  const more = all.filter((a) => a.id !== announcement.id).slice(0, 3);

  return (
    <div>
      {/* Header */}
      <section className="bg-brand-navy">
        <div className="mx-auto max-w-3xl px-6 pb-24 pt-10 text-white sm:pt-12">
          <Link
            href="/announcements"
            className="inline-flex items-center gap-1.5 font-heading text-[0.95rem] tracking-wide text-brand-gold hover:text-white"
          >
            <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
            All News &amp; Articles
          </Link>
          <p className="mt-6 text-sm text-white/70">{formatDate(announcement.publishedAt ?? announcement.createdAt)}</p>
          <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.01em] font-sans! sm:text-[2.6rem]">
            {announcement.title}
          </h1>
        </div>
      </section>

      {/* Article */}
      <article className="mx-auto -mt-16 max-w-3xl px-6">
        <AnnouncementCover
          id={announcement.id}
          className="aspect-[16/7] rounded-xl shadow-[0_10px_30px_-12px_rgb(15_30_61/0.35)]"
          sizes="(min-width: 768px) 720px, 100vw"
        />
        <div className="mt-8 space-y-4 text-[1.0625rem] leading-relaxed text-slate-700 [&_a]:text-brand-maroon [&_a]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-brand-navy [&_h3]:mt-6 [&_h3]:font-bold [&_h3]:text-brand-navy [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_strong]:font-semibold [&_strong]:text-brand-navy">
          <ReactMarkdown>{announcement.body}</ReactMarkdown>
        </div>
        <div className="mt-10 flex flex-col items-start gap-4 rounded-xl bg-brand-cream px-6 py-5 ring-1 ring-[#f1e4c8] sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-brand-navy">Have questions about this? We&apos;re happy to help.</p>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand-maroon px-6 py-2.5 font-heading text-base font-medium tracking-wide text-white transition-colors hover:bg-brand-maroon-dark"
          >
            Contact Us
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </article>

      {/* More news */}
      {more.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.01em] text-brand-navy font-sans!">
            More News &amp; Articles
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </div>
        </section>
      ) : (
        <div className="pb-14" />
      )}
    </div>
  );
}
