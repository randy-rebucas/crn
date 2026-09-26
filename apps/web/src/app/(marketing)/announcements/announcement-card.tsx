import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { excerpt, type PublicAnnouncement } from '@/lib/public-api';
import { Icon } from '../icons';

// Announcements carry no image, so each gets a stable cover from the site's
// own photos, picked by its id so a post keeps the same cover everywhere.
const COVERS = [
  '/01_three_students_studying.png',
  '/04_medical_students_microscope.png',
  '/02_graduate_holding_diploma.png',
  '/03_graduation_group.png',
];

export function coverFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COVERS[hash % COVERS.length];
}

// The cut-out photo on a warm backdrop, shared by the cards and the article header.
export function AnnouncementCover({ id, className = '', sizes }: { id: string; className?: string; sizes: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_100%,#fff6dc_0%,#fbe7b0_55%,#f5c518_130%)] ${className}`}
    >
      <Image src={coverFor(id)} alt="" fill sizes={sizes} className="object-contain object-bottom pt-3" />
    </div>
  );
}

export function AnnouncementCard({ announcement }: { announcement: PublicAnnouncement }) {
  const href = `/announcements/${announcement.id}`;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 shadow-[0_4px_16px_-8px_rgb(15_30_61/0.18)] transition-shadow hover:shadow-[0_10px_24px_-10px_rgb(15_30_61/0.3)]">
      <AnnouncementCover id={announcement.id} className="aspect-[16/9]" sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" />
      <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
        <p className="text-xs text-slate-500">{formatDate(announcement.publishedAt ?? announcement.createdAt)}</p>
        <h2 className="mt-2 text-lg font-bold leading-snug text-brand-navy font-sans!">
          {/* The stretched link makes the whole card clickable. */}
          <Link href={href} className="after:absolute after:inset-0">
            {announcement.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{excerpt(announcement.body, 180)}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 font-heading text-[0.95rem] font-semibold tracking-wide text-brand-maroon group-hover:text-brand-maroon-dark">
          Read More
          <Icon name="arrowRight" className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
