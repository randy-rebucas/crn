'use client';

import Image from 'next/image';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  HeroFigure,
  Panel,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
} from '@/components/student-ui';
import { isUrl } from '@/components/student-library';
import { type LibraryMaterial, useMyMaterials } from '@/lib/student-hooks';

// /student/videos — every published VIDEO material in the student's
// programs, from GET /v1/materials/mine?type=VIDEO. Video `content` is a
// link (YouTube, Drive, …) or a storage key the portal can't play yet; only
// real links become Watch actions. YouTube links get their real thumbnail.
//
// There is no watch tracking server-side, so "opened" is remembered per
// device in localStorage and labelled that way — it's a convenience for
// finding your place, not a completion record.

const DAY_MS = 86_400_000;
const OPENED_KEY = 'obias.student.videos.opened';

// ---------------------------------------------------------------------------
// Link parsing
// ---------------------------------------------------------------------------

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/);
      return m?.[1] ?? null;
    }
  } catch {
    // Not a parseable URL; treated as a plain link below.
  }
  return null;
}

function hostLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('youtu')) return 'YouTube';
    if (host.includes('vimeo')) return 'Vimeo';
    if (host.includes('drive.google') || host.includes('docs.google')) return 'Google Drive';
    if (host.includes('facebook') || host === 'fb.watch') return 'Facebook';
    if (host.includes('zoom')) return 'Zoom recording';
    return host;
  } catch {
    return 'Link';
  }
}

// ---------------------------------------------------------------------------
// Opened-on-this-device memory
// ---------------------------------------------------------------------------

// In-memory copy used when storage is blocked, so marks still last the visit.
let memoryOpened = '[]';
const openedListeners = new Set<() => void>();

function readOpened() {
  try {
    return window.localStorage.getItem(OPENED_KEY) ?? memoryOpened;
  } catch {
    return memoryOpened;
  }
}

function subscribeOpened(cb: () => void) {
  openedListeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    openedListeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function useOpened() {
  const raw = useSyncExternalStore(subscribeOpened, readOpened, () => '[]');
  const opened = useMemo(() => {
    try {
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const markOpened = useCallback(
    (id: string) => {
      if (opened.has(id)) return;
      memoryOpened = JSON.stringify([...opened, id]);
      try {
        window.localStorage.setItem(OPENED_KEY, memoryOpened);
      } catch {
        // Not persisted; the in-memory copy still covers this visit.
      }
      openedListeners.forEach((l) => l());
    },
    [opened],
  );

  return { opened, markOpened };
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

interface CourseGroup {
  id: string;
  code: string;
  name: string;
  subjects: { id: string; name: string; items: LibraryMaterial[] }[];
  count: number;
}

function groupVideos(items: LibraryMaterial[]): CourseGroup[] {
  const courses = new Map<string, CourseGroup>();
  for (const m of items) {
    const subject = m.lesson.module.subject;
    const course = subject.course;
    const g = courses.get(course.id) ?? { id: course.id, code: course.code, name: course.name, subjects: [], count: 0 };
    let s = g.subjects.find((x) => x.id === subject.id);
    if (!s) {
      s = { id: subject.id, name: subject.name, items: [] };
      g.subjects.push(s);
    }
    s.items.push(m);
    g.count += 1;
    courses.set(course.id, g);
  }
  return [...courses.values()];
}

function matches(m: LibraryMaterial, q: string) {
  if (!q) return true;
  const hay = `${m.title} ${m.lesson.name} ${m.lesson.module.name} ${m.lesson.module.subject.name} ${m.lesson.module.subject.course.code}`;
  return hay.toLowerCase().includes(q);
}

// ---------------------------------------------------------------------------
// Video card
// ---------------------------------------------------------------------------

function Thumbnail({ material, opened }: { material: LibraryMaterial; opened: boolean }) {
  const url = isUrl(material.content) ? material.content.trim() : null;
  const ytId = url ? youtubeId(url) : null;
  const [broken, setBroken] = useState(false);
  const showImage = ytId && !broken;

  return (
    <div className="relative aspect-video w-36 shrink-0 self-start overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-red-950 sm:w-full sm:rounded-none">
      {showImage ? (
        <Image
          src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1536px) 22vw, (min-width: 640px) 45vw, 100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          onError={() => setBroken(true)}
        />
      ) : (
        <>
          <div aria-hidden className="absolute inset-y-0 right-0 w-2/5 bg-red-700/30 [clip-path:polygon(40%_0,100%_0,100%_100%,0_100%)]" />
          <p
            aria-hidden
            className="absolute left-3 right-10 top-3 hidden font-[family-name:var(--font-heading)] text-lg font-bold uppercase leading-tight tracking-wide text-white/85 sm:line-clamp-2"
          >
            {material.lesson.name}
          </p>
        </>
      )}

      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      <span
        aria-hidden
        className={`absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-[0_8px_20px_-8px_rgb(0_0_0/0.7)] transition sm:h-12 sm:w-12 [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-6 sm:[&_svg]:w-6 ${
          url ? 'bg-white/95 text-red-700 group-hover:scale-110 group-hover:bg-red-700 group-hover:text-white motion-reduce:group-hover:scale-100' : 'bg-white/70 text-slate-500'
        }`}
      >
        {icons.video}
      </span>

      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white sm:bottom-2 sm:left-2 sm:text-[11px]">
        {material.lesson.module.subject.course.code}
      </span>
      {url && (
        <span className="absolute bottom-2 right-2 hidden max-w-[55%] truncate rounded sm:block bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {hostLabel(url)}
        </span>
      )}
      {opened && (
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white sm:left-2 sm:top-2 sm:px-2 sm:text-[11px]">
          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden>
            <path d="m5 10.5 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Opened
        </span>
      )}
    </div>
  );
}

function VideoCard({ material, opened, onOpen, now }: { material: LibraryMaterial; opened: boolean; onOpen: () => void; now: number }) {
  const url = isUrl(material.content) ? material.content.trim() : null;
  const fresh = now - new Date(material.updatedAt).getTime() < 7 * DAY_MS;

  const body = (
    <>
      <Thumbnail material={material} opened={opened} />
      <div className="flex min-w-0 flex-1 flex-col sm:p-4">
        <p className="line-clamp-2 pt-0.5 text-sm font-semibold leading-snug text-slate-900 sm:pt-0">{material.title}</p>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
          {material.lesson.module.name} › {material.lesson.name}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs sm:pt-3">
          {url ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
              Watch {icons.external}
              <span className="sr-only">(opens in a new tab)</span>
            </span>
          ) : (
            <span className="font-medium text-slate-500">Shown in class</span>
          )}
          {fresh && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">New</span>}
        </div>
      </div>
    </>
  );

  const shell =
    'group flex h-full gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition sm:flex-col sm:gap-0 sm:p-0';

  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      className={`${shell} hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_30px_-18px_rgb(15_23_42/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 motion-reduce:hover:translate-y-0`}
    >
      {body}
    </a>
  ) : (
    <div className={shell}>{body}</div>
  );
}

// ---------------------------------------------------------------------------
// Course coverage: videos per course, split by opened on this device.
// Each row doubles as the course filter.
// ---------------------------------------------------------------------------

function CourseCoverage({
  groups,
  opened,
  selected,
  onSelect,
}: {
  groups: CourseGroup[];
  opened: Set<string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const max = Math.max(1, ...groups.map((g) => g.count));

  return (
    <Panel title="Videos by Course" icon={icons.progress}>
      <ul className="space-y-1" role="group" aria-label="Filter videos by course">
        {groups.map((g) => {
          const seen = g.subjects.reduce((n, s) => n + s.items.filter((m) => opened.has(m.id)).length, 0);
          const active = selected === g.id;
          return (
            <li key={g.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : g.id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-red-700 ${
                  active ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-slate-50'
                }`}
              >
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-red-700">{g.code}</span>{' '}
                    <span className={active ? 'font-medium text-slate-900' : 'text-slate-700'}>{g.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{seen}</span>/{g.count}
                  </span>
                </span>
                <span
                  className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100"
                  style={{ width: `${Math.max(8, (g.count / max) * 100)}%` }}
                  aria-hidden
                >
                  <span className="h-full bg-red-700" style={{ width: `${(seen / g.count) * 100}%` }} />
                  <span className="h-full flex-1 border-l-2 border-white bg-red-200 first:border-l-0" />
                </span>
                <span className="sr-only">
                  {`${g.count} videos, ${seen} opened on this device.`} {active ? 'Showing only this course.' : 'Show only this course.'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-red-700" aria-hidden /> Opened on this device
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-red-200" aria-hidden /> Not opened yet
        </span>
        <span className="w-full text-slate-400">Bar length is the course&apos;s number of videos. Tap a course to filter.</span>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function VideoLibrary() {
  const [now] = useState(() => Date.now());
  const videos = useMyMaterials(['VIDEO']);
  const { opened, markOpened } = useOpened();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const all = useMemo(() => videos.data ?? [], [videos.data]);
  const allGroups = useMemo(() => groupVideos(all), [all]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => all.filter((m) => (!courseId || m.lesson.module.subject.course.id === courseId) && matches(m, q)),
    [all, courseId, q],
  );
  const groups = useMemo(() => groupVideos(shown), [shown]);

  const recent = useMemo(
    () =>
      all
        .filter((m) => now - new Date(m.updatedAt).getTime() < 7 * DAY_MS)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 4),
    [all, now],
  );
  const openedCount = all.filter((m) => opened.has(m.id)).length;
  const watchable = all.filter((m) => isUrl(m.content)).length;
  const filtering = Boolean(courseId || q);
  const selectedGroup = allGroups.find((g) => g.id === courseId);
  const dash = <span className="text-slate-300">—</span>;

  return (
    <StudentShell>
      <StudentPageHero
        badge={icons.video}
        title="Video Lessons"
        meta={<span>Recorded lectures from every course in your program.</span>}
      >
        <HeroFigure icon={icons.video} tone="bg-red-50 text-red-700" value={videos.data ? all.length : dash} label="Video lessons" />
        <HeroFigure icon={icons.learn} tone="bg-blue-50 text-blue-700" value={videos.data ? allGroups.length : dash} label="Courses covered" />
        <HeroFigure icon={icons.sparkle} tone="bg-amber-50 text-amber-700" value={videos.data ? recent.length : dash} label="Added this week" />
        <HeroFigure
          icon={icons.quiz}
          tone="bg-emerald-50 text-emerald-700"
          value={videos.data ? `${openedCount}/${watchable}` : dash}
          label="Opened on this device"
        />
      </StudentPageHero>

      {videos.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}
      {videos.isError && <PanelMessage tone="error">Couldn&apos;t load your video lessons. Refresh the page to try again.</PanelMessage>}
      {videos.data && all.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icons.video}</span>
          <span className="font-semibold text-slate-700">No video lessons yet</span>
          <span>Nothing has been published for your program yet. New recordings will show up here.</span>
        </PanelMessage>
      )}

      {all.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="order-last min-w-0 xl:order-first">
            {/* Toolbar */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block flex-1">
                <span className="sr-only">Search videos</span>
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, lesson, or subject"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 transition placeholder:text-slate-500 focus:border-red-600 focus:outline-none focus:ring-4 focus:ring-red-600/10"
                />
              </label>
              {filtering && (
                <button
                  type="button"
                  onClick={() => {
                    setCourseId(null);
                    setQuery('');
                  }}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  <span className="[&_svg]:h-4 [&_svg]:w-4" aria-hidden>
                    {icons.close}
                  </span>
                  Clear filters
                </button>
              )}
            </div>

            <p className="sr-only" aria-live="polite">
              {filtering ? `${shown.length} of ${all.length} videos shown` : ''}
            </p>

            {filtering && (
              <p className="-mt-2 mb-4 text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-900">{shown.length}</span> of {all.length} videos
                {selectedGroup && (
                  <>
                    {' '}
                    in <span className="font-semibold text-slate-900">{selectedGroup.code}</span>
                  </>
                )}
                {q && (
                  <>
                    {' '}
                    matching &ldquo;<span className="font-semibold text-slate-900">{query.trim()}</span>&rdquo;
                  </>
                )}
              </p>
            )}

            {!filtering && recent.length > 0 && (
              <section aria-labelledby="new-videos" className="mb-8">
                <h2 id="new-videos" className="mb-3 flex items-center gap-2.5 px-1 text-lg font-semibold tracking-wide text-slate-900">
                  <span className="text-amber-600">{icons.sparkle}</span>
                  New This Week
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
                  {recent.map((m) => (
                    <li key={m.id}>
                      <VideoCard material={m} opened={opened.has(m.id)} onOpen={() => markOpened(m.id)} now={now} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {shown.length === 0 && (
              <PanelMessage>
                <span>No videos match these filters.</span>
                <button
                  type="button"
                  onClick={() => {
                    setCourseId(null);
                    setQuery('');
                  }}
                  className="font-semibold text-red-700 underline underline-offset-4"
                >
                  Show all videos
                </button>
              </PanelMessage>
            )}

            <div className="space-y-10">
              {groups.map((g) => (
                <section key={g.id} aria-labelledby={`vcourse-${g.id}`}>
                  <h2 id={`vcourse-${g.id}`} className="mb-4 flex items-center gap-3 px-1">
                    <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-red-700 px-2 font-[family-name:var(--font-heading)] text-sm font-bold tracking-wide text-white">
                      {g.code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold tracking-wide text-slate-900">{g.name}</span>
                      <span className="block text-xs font-normal text-slate-500">
                        {g.count} {g.count === 1 ? 'video' : 'videos'} · {g.subjects.length} {g.subjects.length === 1 ? 'subject' : 'subjects'}
                      </span>
                    </span>
                  </h2>

                  <div className="space-y-6">
                    {g.subjects.map((s) => (
                      <div key={s.id}>
                        <h3 className="mb-3 flex items-center gap-2 border-b border-slate-200 px-1 pb-2 text-sm font-semibold text-slate-700">
                          <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
                            {icons.learn}
                          </span>
                          {s.name}
                          <span className="font-normal text-slate-400">· {s.items.length}</span>
                        </h3>
                        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                          {s.items.map((m) => (
                            <li key={m.id}>
                              <VideoCard material={m} opened={opened.has(m.id)} onOpen={() => markOpened(m.id)} now={now} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <aside className="order-first min-w-0 xl:sticky xl:top-20 xl:order-last" aria-label="Video overview">
            {videos.isLoading ? (
              <SkeletonRows count={4} />
            ) : (
              <CourseCoverage groups={allGroups} opened={opened} selected={courseId} onSelect={setCourseId} />
            )}
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
