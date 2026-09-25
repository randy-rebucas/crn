"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { StatusBadge } from "@/components/ui";
import {
  Chevron,
  HeroFigure,
  Panel,
  PanelLink,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
  programGlyph,
} from "@/components/student-ui";
import { TYPE_META, isUrl } from "@/components/student-library";
import {
  type Enrollment,
  type LibraryMaterial,
  type MaterialType,
  pickActiveEnrollment,
  useMyEnrollments,
  useMyMaterials,
  useMyStudentProfile,
} from "@/lib/student-hooks";

// GAP: Course/Subject/Module/Lesson/Material list endpoints (apps/api/src/
// modules/{courses,subjects,curriculum}) don't filter by ContentStatus
// server-side, so PUBLISHED-only filtering happens client-side at every
// level of the drill-down. Each tap reveals one more level and fetches it
// lazily, so a phone screen never has to render a five-deep outline at once.
//
// The overview (header figures, charts, recently updated) comes from one
// GET /v1/materials/mine call instead. It only sees lessons that hold a
// published material, so it never claims subject or lesson totals — only
// material counts, which it knows exactly.

interface Course {
  id: string;
  name: string;
  code: string;
  status: string;
}
interface Subject {
  id: string;
  name: string;
  status: string;
}
interface ModuleItem {
  id: string;
  name: string;
  status: string;
}
interface Lesson {
  id: string;
  name: string;
  status: string;
}
interface Material {
  id: string;
  title: string;
  type: MaterialType;
  content: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Material families: the eight material types folded into the four places a
// student actually goes for them. Colors are a validated categorical set
// (CVD-safe in this order) and match each type's tone in the library pages.
// ---------------------------------------------------------------------------

type FamilyKey = "videos" | "readings" | "flashcards" | "files";

const FAMILIES: {
  key: FamilyKey;
  unit: [string, string];
  label: string;
  hint: string;
  types: MaterialType[];
  color: string;
  tone: string;
  icon: React.ReactNode;
  href: string;
}[] = [
  {
    key: "videos",
    unit: ["video", "videos"],
    label: "Videos",
    hint: "Recorded lectures and audio",
    types: ["VIDEO", "AUDIO"],
    color: "#b91c1c",
    tone: "bg-red-50 text-red-700",
    icon: icons.video,
    href: "/student/videos",
  },
  {
    key: "readings",
    unit: ["reading", "readings"],
    label: "Readings",
    hint: "PDFs, documents, and notes",
    types: ["PDF", "DOCUMENT", "TEXT"],
    color: "#2563eb",
    tone: "bg-blue-50 text-blue-700",
    icon: icons.materials,
    href: "/student/materials",
  },
  {
    key: "flashcards",
    unit: ["flashcard", "flashcards"],
    label: "Flashcards",
    hint: "Quick recall drills",
    types: ["FLASHCARD"],
    color: "#0d9488",
    tone: "bg-teal-50 text-teal-700",
    icon: icons.quiz,
    href: "/student/materials",
  },
  {
    key: "files",
    unit: ["file or image", "files & images"],
    label: "Files & images",
    hint: "Downloads and diagrams",
    types: ["DOWNLOAD", "IMAGE"],
    color: "#d97706",
    tone: "bg-amber-50 text-amber-700",
    icon: icons.download,
    href: "/student/materials",
  },
];

function familyOf(type: MaterialType): FamilyKey {
  return FAMILIES.find((f) => f.types.includes(type))?.key ?? "readings";
}

type FamilyCounts = Record<FamilyKey, number>;

const emptyCounts = (): FamilyCounts => ({
  videos: 0,
  readings: 0,
  flashcards: 0,
  files: 0,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function plural(n: number, word: string) {
  if (n === 1) return `${n} ${word}`;
  return `${n} ${word}${/(ch|s|x)$/.test(word) ? "es" : "s"}`;
}

function relativeDay(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function usePublishedList<T extends { status: string }>(
  key: unknown[],
  url: string,
  params: Record<string, string>,
  enabled: boolean,
) {
  return useQuery<T[]>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<T[]>(url, { params });
      return data.filter((item) => item.status === "PUBLISHED");
    },
  });
}

// ---------------------------------------------------------------------------
// Header: program identity + the four numbers that orient the page
// ---------------------------------------------------------------------------

// Rendered in every state, like the other student pages: while loading or
// without an enrollment the figures show dashes and the meta line falls back
// to a description, so the page never jumps from a bare title to the hero.
function CoursesHeader({
  active,
  courseCount,
  library,
}: {
  active: Enrollment | null;
  courseCount: number | null;
  library: { total: number; videos: number; fresh: number } | null;
}) {
  const dash = <span className="text-slate-300">—</span>;
  return (
    <StudentPageHero
      badge={active ? programGlyph(active.program.name) : icons.learn}
      title="My Courses"
      meta={
        active ? (
          <>
            <span className="font-semibold text-slate-700">
              {active.program.name}
            </span>
            {active.batch && (
              <>
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <span className="truncate">{active.batch.name}</span>
              </>
            )}
            <StatusBadge status={active.status} />
          </>
        ) : (
          <span>
            Your program&apos;s courses, lessons, and study materials.
          </span>
        )
      }
    >
      <HeroFigure
        icon={icons.learn}
        tone="bg-red-50 text-red-700"
        value={courseCount ?? dash}
        label={courseCount === 1 ? "Course" : "Courses"}
      />
      <HeroFigure
        icon={icons.materials}
        tone="bg-blue-50 text-blue-700"
        value={library ? library.total : dash}
        label="Study materials"
      />
      <HeroFigure
        icon={icons.video}
        tone="bg-red-50 text-red-700"
        value={library ? library.videos : dash}
        label="Video lessons"
      />
      <HeroFigure
        icon={icons.sparkle}
        tone="bg-amber-50 text-amber-700"
        value={library ? library.fresh : dash}
        label="Updated this week"
      />
    </StudentPageHero>
  );
}

// ---------------------------------------------------------------------------
// Chart: materials per course, stacked by family
// ---------------------------------------------------------------------------

interface CourseBar extends FamilyCounts {
  id: string;
  code: string;
  name: string;
  total: number;
}

function CourseTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CourseBar }[];
}) {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  return (
    <div className="min-w-[180px] max-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-[0_10px_24px_-12px_rgb(15_23_42/0.3)]">
      <p className="font-semibold text-slate-900">
        <span className="text-red-700">{c.code}</span> {c.name}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {FAMILIES.map((f) => (
          <li
            key={f.key}
            className="flex items-center justify-between gap-3 text-slate-600"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: f.color }}
                aria-hidden
              />
              {f.label}
            </span>
            <span className="tabular-nums font-medium text-slate-900">
              {c[f.key]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-900">
        Total <span className="tabular-nums">{c.total}</span>
      </p>
    </div>
  );
}

function ContentByCourse({
  data,
  loading,
  error,
  selected,
  onSelect,
}: {
  data: CourseBar[];
  loading: boolean;
  error: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const total = data.reduce((s, c) => s + c.total, 0);
  const height = Math.max(150, data.length * 44 + 36);

  return (
    <Panel title="Content by Course" icon={icons.progress}>
      {loading && (
        <div className="h-[190px] animate-pulse rounded-xl bg-slate-100" />
      )}
      {!loading && error && (
        <PanelMessage tone="error">
          Couldn&apos;t load your study library. Refresh to try again.
        </PanelMessage>
      )}
      {!loading && !error && total === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">
            {icons.progress}
          </span>
          <span>
            This chart fills in once your instructors publish lesson materials.
          </span>
        </PanelMessage>
      )}
      {!loading && !error && total > 0 && (
        <figure>
          <figcaption className="sr-only">
            Published materials per course:{" "}
            {data
              .map(
                (c) =>
                  `${c.code} ${c.name}: ${c.total} (${FAMILIES.map((f) => `${c[f.key]} ${f.unit[c[f.key] === 1 ? 0 : 1]}`).join(", ")})`,
              )
              .join("; ")}
          </figcaption>
          <div aria-hidden className="[&_*:focus]:outline-none">
            <ResponsiveContainer width="100%" height={height}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                barCategoryGap={12}
              >
                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="code"
                  width={72}
                  tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CourseTooltip />}
                  cursor={{ fill: "#f8fafc" }}
                />
                {FAMILIES.map((f) => (
                  <Bar
                    key={f.key}
                    dataKey={f.key}
                    name={f.label}
                    stackId="materials"
                    fill={f.color}
                    stroke="#fff"
                    strokeWidth={2}
                    maxBarSize={22}
                    isAnimationActive={false}
                    cursor="pointer"
                    onClick={(_: unknown, index: number) => {
                      const id = data[index]?.id ?? null;
                      onSelect(id === selected ? null : id);
                    }}
                  >
                    {data.map((c) => (
                      <Cell
                        key={c.id}
                        fillOpacity={selected && selected !== c.id ? 0.25 : 1}
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
            <li className="w-full text-[11px] text-slate-400 sm:order-last sm:ml-auto sm:w-auto">
              Click a bar to filter the curriculum
            </li>
            {FAMILIES.map((f) => (
              <li key={f.key} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: f.color }}
                  aria-hidden
                />
                {f.label}
              </li>
            ))}
          </ul>
        </figure>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Library mix: share of each family, each row a way into that library
// ---------------------------------------------------------------------------

function LibraryMix({
  counts,
  loading,
  error,
}: {
  counts: FamilyCounts;
  loading: boolean;
  error: boolean;
}) {
  const total = FAMILIES.reduce((s, f) => s + counts[f.key], 0);

  return (
    <Panel title="Library Mix" icon={icons.layers}>
      {loading && <SkeletonRows count={4} className="h-11" />}
      {!loading && error && (
        <PanelMessage tone="error">
          Couldn&apos;t load your study library.
        </PanelMessage>
      )}
      {!loading && !error && total === 0 && (
        <PanelMessage>
          No materials have been published for your program yet.
        </PanelMessage>
      )}
      {!loading && !error && total > 0 && (
        <>
          <div
            className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Library of ${total} materials: ${FAMILIES.map((f) => `${counts[f.key]} ${f.unit[counts[f.key] === 1 ? 0 : 1]}`).join(", ")}`}
          >
            {FAMILIES.filter((f) => counts[f.key] > 0).map((f) => (
              <span
                key={f.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ flexGrow: counts[f.key], background: f.color }}
              />
            ))}
          </div>

          <ul className="-mx-2 mt-4 space-y-0.5">
            {FAMILIES.map((f) => {
              const n = counts[f.key];
              const pct = Math.round((n / total) * 100);
              return (
                <li key={f.key}>
                  <Link
                    href={f.href}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${f.tone}`}
                    >
                      {f.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ background: f.color }}
                          aria-hidden
                        />
                        {f.label}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {f.hint}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span
                        className={`block text-sm font-bold ${n === 0 ? "text-slate-400" : "text-slate-900"}`}
                      >
                        {n}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {pct}%
                      </span>
                    </span>
                    <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-red-700 motion-reduce:transition-none">
                      {icons.arrowRight}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// One material, as it appears in the tree and in Recently Updated. Links
// open in a new tab; inline notes expand in place; anything else is a stored
// file the portal can't serve yet, so it says so instead of linking nowhere.
// ---------------------------------------------------------------------------

function MaterialItem({
  title,
  type,
  content,
  detail,
}: {
  title: string;
  type: MaterialType;
  content: string | null;
  detail?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const meta = TYPE_META[type] ?? TYPE_META.TEXT;
  const inlineText = type === "TEXT" && content && !isUrl(content);
  const verb =
    type === "VIDEO"
      ? "Watch"
      : type === "AUDIO"
        ? "Listen"
        : type === "DOWNLOAD"
          ? "Download"
          : "Open";
  const buttonClass =
    "inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700";

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px] ${meta.tone}`}
        >
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-slate-900">
            {title}
          </p>
          <p className="truncate text-xs text-slate-500">
            <span className="font-medium text-slate-600">{meta.label}</span>
            {detail && <> · {detail}</>}
          </p>
        </div>
        {inlineText ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className={`${buttonClass} border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
          >
            {open ? "Hide" : "Read"}
          </button>
        ) : isUrl(content) ? (
          <a
            href={content.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClass} bg-red-700 text-white hover:bg-red-800`}
          >
            {verb}
            {icons.external}
            <span className="sr-only">{title} (opens in a new tab)</span>
          </a>
        ) : (
          <span className="shrink-0 text-[11px] font-medium text-slate-400">
            In class
          </span>
        )}
      </div>
      {inlineText && open && (
        <div
          id={panelId}
          className="mt-2.5 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
        >
          {content}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curriculum drill-down
// ---------------------------------------------------------------------------

function TreeMessage({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "loading" | "error";
}) {
  return (
    <p
      className={`flex items-center gap-2 px-2 py-2.5 text-xs ${tone === "error" ? "text-red-700" : "text-slate-500"}`}
      role={tone === "error" ? "alert" : undefined}
    >
      {tone === "loading" && (
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600"
          aria-hidden
        />
      )}
      {children}
    </p>
  );
}

function Row({
  label,
  lead,
  open,
  controls,
  onToggle,
  strong = false,
}: {
  label: string;
  lead: React.ReactNode;
  open: boolean;
  controls: string;
  onToggle: () => void;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700"
    >
      {lead}
      <span
        className={`min-w-0 flex-1 truncate text-sm ${strong ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}
      >
        {label}
      </span>
      <Chevron open={open} />
    </button>
  );
}

// Nested levels hang off a hairline guide so depth reads without indenting
// a phone screen into nothing.
const NEST = "ml-[1.35rem] border-l border-slate-200 pl-2";

function MaterialsList({ lessonId, id }: { lessonId: string; id: string }) {
  const materials = usePublishedList<Material>(
    ["learn-materials", lessonId],
    "/v1/materials",
    { lessonId },
    true,
  );

  return (
    <div id={id} className={NEST}>
      {materials.isLoading && (
        <TreeMessage tone="loading">Loading materials…</TreeMessage>
      )}
      {materials.isError && (
        <TreeMessage tone="error">
          Couldn&apos;t load this lesson&apos;s materials.
        </TreeMessage>
      )}
      {materials.data?.length === 0 && (
        <TreeMessage>No materials published for this lesson yet.</TreeMessage>
      )}
      {materials.data && materials.data.length > 0 && (
        <ul className="space-y-3 px-2 py-2.5">
          {materials.data.map((m) => (
            <li key={m.id}>
              <MaterialItem title={m.title} type={m.type} content={m.content} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LessonsList({ moduleId, id }: { moduleId: string; id: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const lessons = usePublishedList<Lesson>(
    ["learn-lessons", moduleId],
    "/v1/lessons",
    { moduleId },
    true,
  );

  return (
    <div id={id} className={NEST}>
      {lessons.isLoading && (
        <TreeMessage tone="loading">Loading lessons…</TreeMessage>
      )}
      {lessons.isError && (
        <TreeMessage tone="error">Couldn&apos;t load lessons.</TreeMessage>
      )}
      {lessons.data?.length === 0 && (
        <TreeMessage>No lessons published in this module yet.</TreeMessage>
      )}
      {lessons.data && lessons.data.length > 0 && (
        <ol>
          {lessons.data.map((lesson, i) => {
            const open = openId === lesson.id;
            const childId = `lesson-${lesson.id}`;
            return (
              <li key={lesson.id}>
                <Row
                  label={lesson.name}
                  lead={
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition ${
                        open
                          ? "bg-red-700 text-white"
                          : "bg-white text-slate-600 ring-1 ring-slate-300"
                      }`}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                  }
                  open={open}
                  controls={childId}
                  onToggle={() => setOpenId(open ? null : lesson.id)}
                />
                {open && <MaterialsList lessonId={lesson.id} id={childId} />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ModulesList({ subjectId, id }: { subjectId: string; id: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const modules = usePublishedList<ModuleItem>(
    ["learn-modules", subjectId],
    "/v1/modules",
    { subjectId },
    true,
  );

  return (
    <div id={id} className={NEST}>
      {modules.isLoading && (
        <TreeMessage tone="loading">Loading modules…</TreeMessage>
      )}
      {modules.isError && (
        <TreeMessage tone="error">Couldn&apos;t load modules.</TreeMessage>
      )}
      {modules.data?.length === 0 && (
        <TreeMessage>No modules published in this subject yet.</TreeMessage>
      )}
      {modules.data && modules.data.length > 0 && (
        <ul>
          {modules.data.map((mod) => {
            const open = openId === mod.id;
            const childId = `module-${mod.id}`;
            return (
              <li key={mod.id}>
                <Row
                  label={mod.name}
                  lead={
                    <span
                      className={`shrink-0 transition [&_svg]:h-[18px] [&_svg]:w-[18px] ${open ? "text-red-700" : "text-slate-400"}`}
                    >
                      {icons.layers}
                    </span>
                  }
                  open={open}
                  controls={childId}
                  onToggle={() => setOpenId(open ? null : mod.id)}
                />
                {open && <LessonsList moduleId={mod.id} id={childId} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SubjectsList({ courseId }: { courseId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const subjects = usePublishedList<Subject>(
    ["learn-subjects", courseId],
    "/v1/subjects",
    { courseId },
    true,
  );

  if (subjects.isLoading)
    return <TreeMessage tone="loading">Loading subjects…</TreeMessage>;
  if (subjects.isError)
    return <TreeMessage tone="error">Couldn&apos;t load subjects.</TreeMessage>;
  if (!subjects.data || subjects.data.length === 0)
    return <TreeMessage>No subjects published in this course yet.</TreeMessage>;

  return (
    <ul className="space-y-0.5">
      {subjects.data.map((subject) => {
        const open = openId === subject.id;
        const childId = `subject-${subject.id}`;
        return (
          <li key={subject.id}>
            <Row
              label={subject.name}
              strong
              lead={
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition [&_svg]:h-[18px] [&_svg]:w-[18px] ${
                    open ? "bg-red-700 text-white" : "bg-red-50 text-red-700"
                  }`}
                >
                  {icons.learn}
                </span>
              }
              open={open}
              controls={childId}
              onToggle={() => setOpenId(open ? null : subject.id)}
            />
            {open && <ModulesList subjectId={subject.id} id={childId} />}
          </li>
        );
      })}
    </ul>
  );
}

function CourseItem({
  course,
  stats,
  open,
  onToggle,
}: {
  course: Course;
  stats: (FamilyCounts & { total: number }) | null;
  open: boolean;
  onToggle: () => void;
}) {
  const bodyId = `course-${course.id}`;
  return (
    <li
      className={`overflow-hidden rounded-2xl border bg-white transition ${open ? "border-red-200 shadow-[0_10px_28px_-20px_rgb(127_29_29/0.45)]" : "border-slate-200 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700 sm:px-5"
      >
        <span
          className={`flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2 font-[family-name:var(--font-heading)] text-sm font-bold tracking-wide transition ${
            open ? "bg-red-700 text-white" : "bg-red-50 text-red-700"
          }`}
        >
          {course.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-slate-900">
            {course.name}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {stats === null ? (
              <span>Tap to browse subjects and lessons</span>
            ) : stats.total === 0 ? (
              <span>No materials published yet</span>
            ) : (
              FAMILIES.filter((f) => stats[f.key] > 0).map((f) => (
                <span
                  key={f.key}
                  className="inline-flex items-center gap-1 [&_svg]:h-3.5 [&_svg]:w-3.5"
                >
                  <span style={{ color: f.color }}>{f.icon}</span>
                  <span className="tabular-nums font-medium text-slate-700">
                    {stats[f.key]}
                  </span>
                  {f.unit[stats[f.key] === 1 ? 0 : 1]}
                </span>
              ))
            )}
          </span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          id={bodyId}
          className="border-t border-slate-100 bg-white px-2 py-2 sm:px-3"
        >
          <SubjectsList courseId={course.id} />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Search results: a flat, openable list of matching materials by course.
// Search runs over the library (every lesson that holds a published
// material), not the lazy tree, so a match is always something to open.
// ---------------------------------------------------------------------------

function matchesQuery(m: LibraryMaterial, q: string) {
  const subject = m.lesson.module.subject;
  return `${m.title} ${m.lesson.name} ${m.lesson.module.name} ${subject.name} ${subject.course.code} ${subject.course.name}`
    .toLowerCase()
    .includes(q);
}

function SearchResults({
  items,
  courses,
}: {
  items: LibraryMaterial[];
  courses: Course[];
}) {
  const groups = courses
    .map((c) => ({
      course: c,
      items: items.filter((m) => m.lesson.module.subject.course.id === c.id),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map(({ course, items: found }) => (
        <section
          key={course.id}
          aria-labelledby={`found-${course.id}`}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5"
        >
          <h3
            id={`found-${course.id}`}
            className="mb-4 flex items-center gap-3"
          >
            <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 px-2 font-[family-name:var(--font-heading)] text-xs font-bold tracking-wide text-red-700">
              {course.code}
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
              {course.name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">
              {plural(found.length, "match")}
            </span>
          </h3>
          <ul className="space-y-4">
            {found.map((m) => (
              <li key={m.id}>
                <MaterialItem
                  title={m.title}
                  type={m.type}
                  content={m.content}
                  detail={`${m.lesson.module.subject.name} › ${m.lesson.module.name} › ${m.lesson.name}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recently updated
// ---------------------------------------------------------------------------

function RecentPanel({
  items,
  loading,
  error,
  now,
}: {
  items: LibraryMaterial[];
  loading: boolean;
  error: boolean;
  now: number;
}) {
  return (
    <Panel
      title="Recently Updated"
      icon={icons.sparkle}
      action={
        items.length > 0 ? (
          <PanelLink href="/student/materials">All materials</PanelLink>
        ) : undefined
      }
    >
      {loading && <SkeletonRows count={4} className="h-10" />}
      {!loading && error && (
        <PanelMessage tone="error">
          Couldn&apos;t load recent materials.
        </PanelMessage>
      )}
      {!loading && !error && items.length === 0 && (
        <PanelMessage>
          New and revised materials will show up here.
        </PanelMessage>
      )}
      {items.length > 0 && (
        <ul className="space-y-4">
          {items.map((m) => (
            <li key={m.id}>
              <MaterialItem
                title={m.title}
                type={m.type}
                content={m.content}
                detail={
                  <>
                    <span className="font-medium text-red-700">
                      {m.lesson.module.subject.course.code}
                    </span>{" "}
                    ·{" "}
                    <time dateTime={m.updatedAt}>
                      {relativeDay(m.updatedAt, now)}
                    </time>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LearnPage() {
  const [now] = useState(() => Date.now());
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
  const library = useMyMaterials([]);
  const active = pickActiveEnrollment(enrollments.data);
  const programId = active?.programId;

  const courses = usePublishedList<Course>(
    ["learn-courses", programId],
    "/v1/courses",
    { programId: programId ?? "" },
    Boolean(programId),
  );

  // Library is org-wide across every enrolled program; narrow to the courses
  // of the active one so the charts agree with the course list below.
  const overview = useMemo(() => {
    if (!courses.data || !library.data) return null;
    const byCourse = new Map<string, FamilyCounts & { total: number }>(
      courses.data.map((c) => [c.id, { ...emptyCounts(), total: 0 }]),
    );
    const mine = library.data.filter((m) =>
      byCourse.has(m.lesson.module.subject.course.id),
    );
    const counts = emptyCounts();
    for (const m of mine) {
      const fam = familyOf(m.type);
      const row = byCourse.get(m.lesson.module.subject.course.id)!;
      row[fam] += 1;
      row.total += 1;
      counts[fam] += 1;
    }
    const bars: CourseBar[] = courses.data.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      ...byCourse.get(c.id)!,
    }));
    const recent = [...mine]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 5);
    const fresh = mine.filter(
      (m) => now - new Date(m.updatedAt).getTime() < 7 * DAY_MS,
    ).length;
    return { byCourse, bars, counts, recent, mine, total: mine.length, fresh };
  }, [courses.data, library.data, now]);

  const q = query.trim().toLowerCase();
  const searchHits = useMemo(
    () =>
      q && overview
        ? overview.mine.filter(
            (m) =>
              (!courseFilter ||
                m.lesson.module.subject.course.id === courseFilter) &&
              matchesQuery(m, q),
          )
        : [],
    [q, overview, courseFilter],
  );

  // Picking a course (chart bar or chip) narrows the list and opens it.
  const selectCourse = (id: string | null) => {
    setCourseFilter(id);
    if (id) setOpenCourseId(id);
  };
  const clearFilters = () => {
    setCourseFilter(null);
    setQuery("");
  };
  const filtering = Boolean(courseFilter || q);
  const selectedCourse = courses.data?.find((c) => c.id === courseFilter);

  const isLoading = profile.isLoading || enrollments.isLoading;
  const isError = profile.isError || enrollments.isError;
  const overviewLoading = courses.isLoading || library.isLoading;

  return (
    <StudentShell>
      <CoursesHeader
        active={active}
        courseCount={courses.data?.length ?? null}
        library={
          overview
            ? {
                total: overview.total,
                videos: overview.counts.videos,
                fresh: overview.fresh,
              }
            : null
        }
      />

      {isLoading && <SkeletonRows count={3} className="h-20" />}
      {isError && (
        <PanelMessage tone="error">
          Couldn&apos;t load your enrollment. Refresh the page to try again.
        </PanelMessage>
      )}
      {!isLoading && !isError && !active && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">
            {icons.learn}
          </span>
          <span className="font-semibold text-slate-700">
            No active enrollment
          </span>
          <span>
            Once you&apos;re enrolled in a program, its courses will show up
            here.
          </span>
        </PanelMessage>
      )}

      {!isLoading && !isError && active && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:items-start">
          <div className="grid min-w-0 gap-5">
            <ContentByCourse
              data={overview?.bars ?? []}
              loading={overviewLoading}
              error={library.isError || courses.isError}
              selected={courseFilter}
              onSelect={selectCourse}
            />

            <section aria-labelledby="curriculum-heading" className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
                <h2
                  id="curriculum-heading"
                  className="flex items-center gap-2.5 text-lg font-semibold tracking-wide text-slate-900"
                >
                  <span className="text-red-700">{icons.learn}</span>
                  Curriculum
                  {courses.data && (
                    <span className="text-sm font-normal text-slate-400">
                      · {plural(courses.data.length, "course")}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  Course › subject › module › lesson
                </p>
              </div>

              {courses.data && courses.data.length > 0 && (
                <div className="mb-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="relative block flex-1">
                      <span className="sr-only">Search course materials</span>
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        {icons.search}
                      </span>
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search materials, lessons, and subjects"
                        disabled={!overview}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 transition placeholder:text-slate-500 focus:border-red-600 focus:outline-none focus:ring-4 focus:ring-red-600/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                      />
                    </label>
                    {filtering && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      >
                        <span className="[&_svg]:h-4 [&_svg]:w-4" aria-hidden>
                          {icons.close}
                        </span>
                        Clear filters
                      </button>
                    )}
                  </div>

                  {courses.data.length > 1 && (
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Filter by course"
                    >
                      {[null, ...courses.data].map((c) => {
                        const id = c?.id ?? null;
                        const selected = courseFilter === id;
                        const count = c
                          ? overview?.byCourse.get(c.id)?.total
                          : overview?.total;
                        return (
                          <button
                            key={id ?? "all"}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => selectCourse(id)}
                            title={c?.name}
                            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                              selected
                                ? "border-red-700 bg-red-700 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {c ? c.code : "All courses"}
                            {count !== undefined && (
                              <span
                                className={`tabular-nums ${selected ? "text-red-100" : "text-slate-400"}`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p className="sr-only" aria-live="polite">
                    {q
                      ? `${plural(searchHits.length, "material")} found`
                      : selectedCourse
                        ? `Showing ${selectedCourse.name}`
                        : ""}
                  </p>
                  {q && (
                    <p className="text-sm text-slate-500">
                      <span className="font-semibold text-slate-900">
                        {plural(searchHits.length, "material")}
                      </span>{" "}
                      matching &ldquo;
                      <span className="font-semibold text-slate-900">
                        {query.trim()}
                      </span>
                      &rdquo;
                      {selectedCourse && (
                        <>
                          {" "}
                          in{" "}
                          <span className="font-semibold text-slate-900">
                            {selectedCourse.code}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              {courses.isLoading && <SkeletonRows count={3} className="h-20" />}
              {courses.isError && (
                <PanelMessage tone="error">
                  Couldn&apos;t load your courses. Refresh to try again.
                </PanelMessage>
              )}
              {courses.data?.length === 0 && (
                <PanelMessage>
                  <span className="font-semibold text-slate-700">
                    Nothing published yet
                  </span>
                  <span>
                    Your program&apos;s courses haven&apos;t been published for
                    students yet.
                  </span>
                </PanelMessage>
              )}
              {q && courses.data && searchHits.length > 0 && (
                <SearchResults items={searchHits} courses={courses.data} />
              )}
              {q && searchHits.length === 0 && (
                <PanelMessage>
                  <span>No materials match these filters.</span>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-semibold text-red-700 underline underline-offset-4"
                  >
                    Show the full curriculum
                  </button>
                </PanelMessage>
              )}
              {!q && courses.data && courses.data.length > 0 && (
                <ul className="space-y-3">
                  {courses.data
                    .filter(
                      (course) => !courseFilter || course.id === courseFilter,
                    )
                    .map((course) => {
                      const open = openCourseId === course.id;
                      return (
                        <CourseItem
                          key={course.id}
                          course={course}
                          stats={overview?.byCourse.get(course.id) ?? null}
                          open={open}
                          onToggle={() =>
                            setOpenCourseId(open ? null : course.id)
                          }
                        />
                      );
                    })}
                </ul>
              )}
            </section>
          </div>

          <aside
            className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1"
            aria-label="Library overview"
          >
            <LibraryMix
              counts={overview?.counts ?? emptyCounts()}
              loading={overviewLoading}
              error={library.isError}
            />
            <RecentPanel
              items={overview?.recent ?? []}
              loading={overviewLoading}
              error={library.isError}
              now={now}
            />
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
