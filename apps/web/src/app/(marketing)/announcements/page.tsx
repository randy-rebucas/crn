import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { listAnnouncements } from '@/lib/public-api';

export const metadata: Metadata = {
  title: 'Announcements',
  description: 'Latest news and announcements from OBIAS Nursing & Allied Courses Review Center.',
};

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-heading text-3xl font-bold text-slate-900">Announcements</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Stay up to date with the latest news.</p>

      {announcements.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No announcements posted yet.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {announcements.map((a) => (
            <Link
              key={a.id}
              href={`/announcements/${a.id}`}
              className="block rounded-xl border border-slate-200 bg-brand-cream p-6 transition hover:border-brand-maroon"
            >
              <p className="text-xs text-slate-500">{formatDate(a.publishedAt ?? a.createdAt)}</p>
              <h2 className="mt-1 font-heading font-semibold text-slate-900">{a.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.body}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
