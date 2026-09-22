import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { API_BASE_URL } from '@/lib/api-client';

interface PublicAnnouncement {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
}

async function getAnnouncement(id: string): Promise<PublicAnnouncement | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/v1/public/announcements/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  return { title: announcement?.title ?? 'Announcement' };
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
      <p className="mt-4 text-xs text-slate-500">
        {new Date(announcement.publishedAt ?? announcement.createdAt).toLocaleDateString()}
      </p>
      <h1 className="mt-1 font-heading text-3xl font-bold text-slate-900">{announcement.title}</h1>
      <p className="mt-4 whitespace-pre-line text-slate-600">{announcement.body}</p>
    </div>
  );
}
