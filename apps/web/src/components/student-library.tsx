'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  HeroFigure,
  Panel,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
} from '@/components/student-ui';
import { type LibraryMaterial, type MaterialType, useMyMaterials } from '@/lib/student-hooks';

// Program-wide material library behind /student/materials (videos have
// their own view in student-videos.tsx), fed by GET /v1/materials/mine.
// Material `content` is either inline text or a URL / storage key: only
// http(s) URLs get an open action, inline TEXT expands in place, anything
// else points back to the lesson in My Courses rather than rendering a dead
// link.

export const TYPE_META: Record<MaterialType, { label: string; tone: string; icon: React.ReactNode }> = {
  VIDEO: { label: 'Video', tone: 'bg-red-50 text-red-700', icon: icons.video },
  PDF: { label: 'PDF', tone: 'bg-rose-50 text-rose-700', icon: icons.materials },
  DOCUMENT: { label: 'Document', tone: 'bg-blue-50 text-blue-700', icon: icons.materials },
  TEXT: { label: 'Notes', tone: 'bg-slate-100 text-slate-700', icon: icons.learn },
  IMAGE: { label: 'Image', tone: 'bg-emerald-50 text-emerald-700', icon: icons.materials },
  AUDIO: { label: 'Audio', tone: 'bg-violet-50 text-violet-700', icon: icons.video },
  DOWNLOAD: { label: 'Download', tone: 'bg-amber-50 text-amber-700', icon: icons.download },
  FLASHCARD: { label: 'Flashcards', tone: 'bg-teal-50 text-teal-700', icon: icons.quiz },
};

export function isUrl(content: string | null): content is string {
  return Boolean(content && /^https?:\/\//i.test(content.trim()));
}

const DAY_MS = 86_400_000;
const READING_TYPES: MaterialType[] = ['PDF', 'DOCUMENT', 'TEXT'];
const FILE_TYPES: MaterialType[] = ['DOWNLOAD', 'IMAGE'];

function relativeDay(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function matches(m: LibraryMaterial, q: string) {
  if (!q) return true;
  const subject = m.lesson.module.subject;
  return `${m.title} ${m.lesson.name} ${m.lesson.module.name} ${subject.name} ${subject.course.code} ${subject.course.name}`
    .toLowerCase()
    .includes(q);
}

interface CourseGroup {
  id: string;
  code: string;
  name: string;
  count: number;
  subjects: { id: string; name: string; items: LibraryMaterial[] }[];
}

function groupByCourse(items: LibraryMaterial[]): CourseGroup[] {
  const courses = new Map<string, CourseGroup>();
  for (const m of items) {
    const subject = m.lesson.module.subject;
    const course = subject.course;
    const g = courses.get(course.id) ?? { id: course.id, code: course.code, name: course.name, count: 0, subjects: [] };
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

// ---------------------------------------------------------------------------
// One material row
// ---------------------------------------------------------------------------

function MaterialAction({ material }: { material: LibraryMaterial }) {
  const base =
    'inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700';
  if (isUrl(material.content)) {
    return (
      <a href={material.content.trim()} target="_blank" rel="noopener noreferrer" className={`${base} bg-red-700 text-white hover:bg-red-800`}>
        {material.type === 'DOWNLOAD' ? 'Download' : material.type === 'AUDIO' ? 'Listen' : 'Open'}
        {icons.external}
        <span className="sr-only">{material.title} (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href="/student/learn" className={`${base} border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50`}>
      View in course
    </Link>
  );
}

function MaterialRow({
  material,
  detail,
  now,
  showNew = true,
}: {
  material: LibraryMaterial;
  detail: React.ReactNode;
  now: number;
  showNew?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[material.type];
  const inlineText = material.type === 'TEXT' && material.content && !isUrl(material.content);
  const fresh = showNew && now - new Date(material.updatedAt).getTime() < 7 * DAY_MS;
  const panelId = `note-${material.id}`;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="line-clamp-2 [overflow-wrap:anywhere]">{material.title}</span>
            {fresh && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">New</span>}
          </p>
          <p className="truncate text-xs text-slate-500">
            <span className="font-medium text-slate-600">{meta.label}</span> · {detail}
          </p>
        </div>
        {inlineText ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex min-h-[34px] shrink-0 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            {open ? 'Hide' : 'Read'}
          </button>
        ) : (
          <MaterialAction material={material} />
        )}
      </div>
      {inlineText && open && (
        <div id={panelId} className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          {material.content}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Rail: materials per course (doubles as the course filter) and recent updates
// ---------------------------------------------------------------------------

function ByCourse({ groups, selected, onSelect }: { groups: CourseGroup[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <Panel title="Materials by Course" icon={icons.progress}>
      <ul className="space-y-1" role="group" aria-label="Filter materials by course">
        {groups.map((g) => {
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
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">{g.count}</span>
                </span>
                <span className="mt-2 block h-2 rounded-full bg-slate-100" aria-hidden>
                  <span
                    className={`block h-full rounded-full ${selected && !active ? 'bg-red-200' : 'bg-red-700'}`}
                    style={{ width: `${Math.max(4, (g.count / max) * 100)}%` }}
                  />
                </span>
                <span className="sr-only">
                  {`${g.count} materials.`} {active ? 'Showing only this course.' : 'Show only this course.'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">Tap a course to show only its materials.</p>
    </Panel>
  );
}

function RecentlyUpdated({ items, now }: { items: LibraryMaterial[]; now: number }) {
  return (
    <Panel title="Recently Updated" icon={icons.sparkle}>
      {items.length === 0 ? (
        <PanelMessage>New and revised materials will show up here.</PanelMessage>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              now={now}
              showNew={false}
              detail={
                <>
                  <span className="font-medium text-red-700">{m.lesson.module.subject.course.code}</span> ·{' '}
                  <time dateTime={m.updatedAt}>{relativeDay(m.updatedAt, now)}</time>
                </>
              }
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function MaterialLibrary({
  types,
  title,
  description,
  emptyTitle,
}: {
  types: MaterialType[];
  title: string;
  description: string;
  emptyTitle: string;
}) {
  const [now] = useState(() => Date.now());
  const materials = useMyMaterials(types);
  const [typeFilter, setTypeFilter] = useState<MaterialType | 'ALL'>('ALL');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const all = useMemo(() => materials.data ?? [], [materials.data]);
  const allGroups = useMemo(() => groupByCourse(all), [all]);
  const present = useMemo(() => types.filter((t) => all.some((m) => m.type === t)), [types, all]);
  const q = query.trim().toLowerCase();

  // Type counts follow the course and search filters so each chip says what
  // tapping it would show.
  const scoped = useMemo(
    () => all.filter((m) => (!courseId || m.lesson.module.subject.course.id === courseId) && matches(m, q)),
    [all, courseId, q],
  );
  const shown = useMemo(() => scoped.filter((m) => typeFilter === 'ALL' || m.type === typeFilter), [scoped, typeFilter]);
  const groups = useMemo(() => groupByCourse(shown), [shown]);
  const recent = useMemo(() => [...all].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5), [all]);

  const readings = all.filter((m) => READING_TYPES.includes(m.type)).length;
  const files = all.filter((m) => FILE_TYPES.includes(m.type)).length;
  const fresh = all.filter((m) => now - new Date(m.updatedAt).getTime() < 7 * DAY_MS).length;
  const filtering = typeFilter !== 'ALL' || Boolean(courseId) || Boolean(q);
  const selectedGroup = allGroups.find((g) => g.id === courseId);
  const dash = <span className="text-slate-300">—</span>;
  const clear = () => {
    setTypeFilter('ALL');
    setCourseId(null);
    setQuery('');
  };

  return (
    <StudentShell>
      <StudentPageHero badge={icons.materials} title={title} meta={<span>{description}</span>}>
        <HeroFigure icon={icons.materials} tone="bg-red-50 text-red-700" value={materials.data ? all.length : dash} label="Study materials" />
        <HeroFigure icon={icons.learn} tone="bg-blue-50 text-blue-700" value={materials.data ? readings : dash} label="PDFs, documents & notes" />
        <HeroFigure icon={icons.download} tone="bg-amber-50 text-amber-700" value={materials.data ? files : dash} label="Downloads & images" />
        <HeroFigure icon={icons.sparkle} tone="bg-emerald-50 text-emerald-700" value={materials.data ? fresh : dash} label="Updated this week" />
      </StudentPageHero>

      {materials.isLoading && <SkeletonRows count={4} className="h-16" />}
      {materials.isError && <PanelMessage tone="error">Couldn&apos;t load your materials. Refresh the page to try again.</PanelMessage>}
      {materials.data && all.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icons.materials}</span>
          <span className="font-semibold text-slate-700">{emptyTitle}</span>
          <span>Nothing has been published for your program yet. New uploads will show up here.</span>
        </PanelMessage>
      )}

      {all.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="min-w-0">
            <div className="mb-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block flex-1">
                  <span className="sr-only">Search materials</span>
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
                    onClick={clear}
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  >
                    <span className="[&_svg]:h-4 [&_svg]:w-4" aria-hidden>
                      {icons.close}
                    </span>
                    Clear filters
                  </button>
                )}
              </div>

              {present.length > 1 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
                  {(['ALL', ...present] as const).map((t) => {
                    const selected = typeFilter === t;
                    const count = t === 'ALL' ? scoped.length : scoped.filter((m) => m.type === t).length;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setTypeFilter(t)}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                          selected ? 'border-red-700 bg-red-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {t !== 'ALL' && (
                          <span className={`[&_svg]:h-3.5 [&_svg]:w-3.5 ${selected ? 'text-white' : 'text-slate-400'}`} aria-hidden>
                            {TYPE_META[t].icon}
                          </span>
                        )}
                        {t === 'ALL' ? 'All types' : TYPE_META[t].label}
                        <span className={`tabular-nums ${selected ? 'text-red-100' : 'text-slate-400'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {allGroups.length > 1 && (
                <div className="flex flex-wrap gap-2 xl:hidden" role="group" aria-label="Filter by course">
                  {[null, ...allGroups].map((g) => {
                    const id = g?.id ?? null;
                    const selected = courseId === id;
                    return (
                      <button
                        key={id ?? 'all'}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCourseId(id)}
                        title={g?.name}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                          selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {g ? g.code : 'All courses'}
                        <span className={`tabular-nums ${selected ? 'text-slate-300' : 'text-slate-400'}`}>{g ? g.count : all.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="sr-only" aria-live="polite">
                {filtering ? `${shown.length} of ${all.length} materials shown` : ''}
              </p>
              {filtering && (
                <p className="text-sm text-slate-500">
                  Showing <span className="font-semibold text-slate-900">{shown.length}</span> of {all.length} materials
                  {typeFilter !== 'ALL' && (
                    <>
                      {' '}
                      · <span className="font-semibold text-slate-900">{TYPE_META[typeFilter].label}</span>
                    </>
                  )}
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
            </div>

            {shown.length === 0 && (
              <PanelMessage>
                <span>No materials match these filters.</span>
                <button type="button" onClick={clear} className="font-semibold text-red-700 underline underline-offset-4">
                  Show all materials
                </button>
              </PanelMessage>
            )}

            <div className="space-y-8">
              {groups.map((g) => (
                <section key={g.id} aria-labelledby={`mcourse-${g.id}`}>
                  <h2 id={`mcourse-${g.id}`} className="mb-3 flex items-center gap-3 px-1">
                    <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-red-700 px-2 font-[family-name:var(--font-heading)] text-sm font-bold tracking-wide text-white">
                      {g.code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold tracking-wide text-slate-900">{g.name}</span>
                      <span className="block text-xs font-normal text-slate-500">
                        {g.count} {g.count === 1 ? 'material' : 'materials'} · {g.subjects.length} {g.subjects.length === 1 ? 'subject' : 'subjects'}
                      </span>
                    </span>
                  </h2>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
                    {g.subjects.map((s) => (
                      <div key={s.id} className="border-t border-slate-100 first:border-t-0">
                        <h3 className="flex items-center gap-2 bg-slate-50/80 px-4 py-2.5 text-xs font-semibold text-slate-700 sm:px-5">
                          <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
                            {icons.learn}
                          </span>
                          {s.name}
                          <span className="font-normal text-slate-400">· {s.items.length}</span>
                        </h3>
                        <ul className="divide-y divide-slate-100 px-4 py-3 sm:px-5">
                          {s.items.map((m) => (
                            <MaterialRow key={m.id} material={m} now={now} detail={`${m.lesson.module.name} › ${m.lesson.name}`} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:sticky xl:top-20 xl:grid-cols-1" aria-label="Library overview">
            <ByCourse groups={allGroups} selected={courseId} onSelect={setCourseId} />
            <RecentlyUpdated items={recent} now={now} />
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
