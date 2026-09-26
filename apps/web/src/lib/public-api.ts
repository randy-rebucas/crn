import { API_BASE_URL } from '@/lib/api-client';

// Server-side reads of GET /v1/public/* for the marketing site. Shapes mirror
// the explicit selects in apps/api/src/modules/public/public.service.ts.

export interface PublicCourse {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface PublicProgram {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  courses: PublicCourse[];
}

export interface PublicBranch {
  id: string;
  name: string;
  code: string;
  address: string | null;
}

export interface PublicInstructor {
  id: string;
  bio: string | null;
  specialization: string | null;
  user: { firstName: string; lastName: string };
}

export type BatchStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PublicBatch {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: BatchStatus;
  program: { id: string; name: string };
  branch: { id: string; name: string };
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface PublicSuccessStory {
  id: string;
  graduateName: string;
  programName: string;
  year: number | null;
  testimonial: string;
  photoUrl: string | null;
}

export interface PublicFaqItem {
  id: string;
  question: string;
  answer: string;
}

// `next build` prerenders the ISR pages, and the API is often not running
// then. Lists degrade to empty during the build only; ISR replaces them on
// the first revalidation.
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

// An outage must not look like "no content" or "page not found": a 404 is
// null, anything else throws so the segment's error.tsx renders (or, on an
// ISR revalidation, Next keeps serving the last good page).
async function get<T>(path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/v1/public${path}`, { next: { revalidate: 60 } });
  } catch (err) {
    throw new Error(`GET /v1/public${path} failed`, { cause: err });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /v1/public${path} returned ${res.status}`);
  return (await res.json()) as T;
}

async function list<T>(path: string): Promise<T[]> {
  try {
    return (await get<T[]>(path)) ?? [];
  } catch (err) {
    if (IS_BUILD) return [];
    throw err;
  }
}

const segment = (value: string) => encodeURIComponent(value);

export const listPrograms = () => list<PublicProgram>('/programs');
export const getProgram = (slug: string) => get<PublicProgram>(`/programs/${segment(slug)}`);
export const listBranches = () => list<PublicBranch>('/branches');
export const listInstructors = () => list<PublicInstructor>('/instructors');
export const getInstructor = (id: string) => get<PublicInstructor>(`/instructors/${segment(id)}`);
export const listSchedule = () => list<PublicBatch>('/schedule');
export const listAnnouncements = () => list<PublicAnnouncement>('/announcements');
export const getAnnouncement = (id: string) => get<PublicAnnouncement>(`/announcements/${segment(id)}`);
export const listSuccessStories = () => list<PublicSuccessStory>('/success-stories');
export const listFaqItems = () => list<PublicFaqItem>('/faq');

/** Plain-text excerpt of markdown content, for meta descriptions. */
// A batch's status as visitors should see it. Staff don't always move a batch
// on from UPCOMING, so the dates win: a batch that has ended is dropped (null)
// and one that has started reads as ongoing.
export function publicBatchStatus(batch: PublicBatch, now = new Date()): 'UPCOMING' | 'ACTIVE' | null {
  if (batch.status !== 'UPCOMING' && batch.status !== 'ACTIVE') return null;
  if (batch.endDate && new Date(batch.endDate) < now) return null;
  return new Date(batch.startDate) <= now ? 'ACTIVE' : 'UPCOMING';
}

// Courses in curriculum order: codes carry the sequence (e.g. NURSING-NLE-1,
// NURSING-NLE-2), so a numeric-aware sort puts them in the order taught.
export function coursesInOrder(courses: PublicCourse[]): PublicCourse[] {
  return [...courses].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function excerpt(markdown: string, max = 160): string {
  const text = markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
