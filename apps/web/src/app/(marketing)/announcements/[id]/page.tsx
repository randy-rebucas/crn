import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { formatDate } from '@/lib/format';
import { excerpt, getAnnouncement } from '@/lib/public-api';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) return { title: 'Announcement' };
  return { title: announcement.title, description: excerpt(announcement.body) };
}

export default async function AnnouncementDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/announcements" className="text-sm text-brand-maroon hover:underline">
        ← Back to announcements
      </Link>
      <p className="mt-4 text-xs text-slate-500">{formatDate(announcement.publishedAt ?? announcement.createdAt)}</p>
      <h1 className="mt-1 font-heading text-3xl font-bold text-slate-900">{announcement.title}</h1>
      <div className="mt-4 space-y-3 text-slate-600 [&_a]:text-brand-maroon [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
        <ReactMarkdown>{announcement.body}</ReactMarkdown>
      </div>
    </div>
  );
}
