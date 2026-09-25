"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  type AttemptSummary,
  useMyAttempts,
  useMyStudentProfile,
} from "@/lib/student-hooks";
import { StatusBadge } from "@/components/ui";
import { ScoreTrend } from "@/components/student-score-trend";
import {
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

// Performance: every number traces to GET /v1/attempts/me (self-scoped,
// delayed results redacted until graded) or GET /v1/progress/me (per-program
// roll-up; needs `progress.view`, so it degrades to a message on 403).
// Exam types come from the published exam list, since attempts don't carry
// them.

type ExamType = "MOCK" | "FINAL" | "PRACTICE" | "DIAGNOSTIC";

interface ExamLite {
  id: string;
  type: ExamType;
}

interface MyProgress {
  programs: {
    enrollmentId: string;
    programName: string;
    enrollmentStatus: string;
    exams: {
      graded: number;
      averageScorePct: number | null;
      passRate: number | null;
    };
    attendance: {
      totalSessions: number;
      present: number;
      attendanceRate: number | null;
    };
  }[];
  overall: { averageScorePct: number | null; attendanceRate: number | null };
}

const TYPE_META: Record<
  ExamType,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  MOCK: {
    label: "Mock board",
    icon: icons.practice,
    tone: "bg-red-50 text-red-700",
  },
  FINAL: {
    label: "Final",
    icon: icons.certificate,
    tone: "bg-amber-50 text-amber-700",
  },
  PRACTICE: {
    label: "Practice",
    icon: icons.quiz,
    tone: "bg-blue-50 text-blue-700",
  },
  DIAGNOSTIC: {
    label: "Diagnostic",
    icon: icons.search,
    tone: "bg-violet-50 text-violet-700",
  },
};
const TYPE_ORDER: ExamType[] = ["MOCK", "FINAL", "PRACTICE", "DIAGNOSTIC"];

type Graded = AttemptSummary & { pct: number; passPct: number };

function isGraded(
  a: AttemptSummary,
): a is AttemptSummary & { score: number; maxScore: number } {
  return a.status === "GRADED" && a.score !== undefined && Boolean(a.maxScore);
}

function toGraded(
  a: AttemptSummary & { score: number; maxScore: number },
): Graded {
  return {
    ...a,
    pct: Math.round((a.score / a.maxScore) * 100),
    passPct: Math.min(
      100,
      Math.round((a.exam.passingScore / a.maxScore) * 100),
    ),
  };
}

function avg(nums: number[]) {
  return nums.length
    ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length)
    : null;
}

// ---------------------------------------------------------------------------
// Score bar with a passing-mark tick, shared by several panels
// ---------------------------------------------------------------------------

function ScoreBar({
  pct,
  passPct,
  passed,
  thick = false,
}: {
  pct: number;
  passPct: number;
  passed: boolean;
  thick?: boolean;
}) {
  return (
    <div
      className={`relative rounded-full bg-slate-100 ${thick ? "h-2.5" : "h-2"}`}
      aria-hidden
    >
      <div
        className={`h-full rounded-full ${passed ? "bg-emerald-600" : "bg-amber-500"}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
      <span
        className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-slate-900"
        style={{ left: `calc(${passPct}% - 1px)` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// By exam type
// ---------------------------------------------------------------------------

function ByType({
  graded,
  typeOf,
}: {
  graded: Graded[];
  typeOf: (examId: string) => ExamType | null;
}) {
  const rows = TYPE_ORDER.map((t) => {
    const list = graded.filter((a) => typeOf(a.examId) === t);
    return {
      type: t,
      count: list.length,
      avgPct: avg(list.map((a) => a.pct)),
      passRate: list.length
        ? Math.round((list.filter((a) => a.passed).length / list.length) * 100)
        : null,
      passPct: avg(list.map((a) => a.passPct)),
    };
  }).filter((r) => r.count > 0);

  return (
    <Panel title="By Exam Type" icon={icons.exams}>
      {rows.length === 0 ? (
        <PanelMessage>
          Averages by exam type appear once an attempt is graded.
        </PanelMessage>
      ) : (
        <figure>
          <figcaption className="sr-only">
            Average score by exam type:{" "}
            {rows
              .map(
                (r) =>
                  `${TYPE_META[r.type].label} ${r.avgPct}% over ${r.count} attempts, ${r.passRate}% passed`,
              )
              .join("; ")}
          </figcaption>
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((r) => {
              const meta = TYPE_META[r.type];
              const passed = (r.avgPct ?? 0) >= (r.passPct ?? 0);
              return (
                <li
                  key={r.type}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {meta.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.count} graded{" "}
                        {r.count === 1 ? "attempt" : "attempts"} · {r.passRate}%
                        passed
                      </p>
                    </div>
                    <p
                      className={`text-2xl font-bold tabular-nums ${passed ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {r.avgPct}%
                    </p>
                  </div>
                  <div className="mt-3">
                    <ScoreBar
                      pct={r.avgPct ?? 0}
                      passPct={r.passPct ?? 0}
                      passed={passed}
                      thick
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Average score · typical passing mark {r.passPct}%
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </figure>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Rail: what to retake, what went well, program roll-up
// ---------------------------------------------------------------------------

function bestPerExam(graded: Graded[]) {
  const best = new Map<string, Graded>();
  for (const a of graded) {
    const cur = best.get(a.examId);
    if (!cur || a.pct > cur.pct) best.set(a.examId, a);
  }
  return [...best.values()];
}

function FocusRow({ a, tone }: { a: Graded; tone: "amber" | "emerald" }) {
  return (
    <li>
      <Link
        href={`/student/exams/${a.examId}`}
        className="group block rounded-xl px-2 py-2.5 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
      >
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-medium text-slate-900">
            {a.exam.title}
          </span>
          <span
            className={`shrink-0 font-bold tabular-nums ${tone === "amber" ? "text-amber-700" : "text-emerald-700"}`}
          >
            {a.pct}%
          </span>
        </span>
        <span className="mt-1.5 block">
          <ScoreBar
            pct={a.pct}
            passPct={a.passPct}
            passed={tone === "emerald"}
          />
        </span>
        <span className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {tone === "amber"
              ? `${a.passPct - a.pct} pts short of passing`
              : `${a.pct - a.passPct} pts above passing`}
          </span>
          {tone === "amber" && (
            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
              Retake {icons.arrowRight}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function FocusPanel({ graded }: { graded: Graded[] }) {
  const bests = bestPerExam(graded);
  const retake = bests
    .filter((a) => !graded.some((g) => g.examId === a.examId && g.passed))
    .sort((a, b) => a.pct - b.pct);
  const top = bests
    .filter((a) => a.passed)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  return (
    <>
      <Panel title="Needs Another Try" icon={icons.help}>
        {retake.length === 0 ? (
          <PanelMessage>
            <span className="text-emerald-600 [&_svg]:h-7 [&_svg]:w-7">
              {icons.quiz}
            </span>
            {graded.length === 0
              ? "Exams you haven’t passed yet will be listed here."
              : "Nothing to retake. Every graded exam is passed."}
          </PanelMessage>
        ) : (
          <ul className="-mx-2 space-y-1">
            {retake.slice(0, 5).map((a) => (
              <FocusRow key={a.examId} a={a} tone="amber" />
            ))}
          </ul>
        )}
      </Panel>
      {top.length > 0 && (
        <Panel title="Best Results" icon={icons.certificate}>
          <ul className="-mx-2 space-y-1">
            {top.map((a) => (
              <FocusRow key={a.examId} a={a} tone="emerald" />
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function ProgramsPanel({
  progress,
  loading,
  unavailable,
}: {
  progress: MyProgress | undefined;
  loading: boolean;
  unavailable: boolean;
}) {
  return (
    <Panel title="By Program" icon={icons.learn}>
      {loading && <SkeletonRows count={1} className="h-32" />}
      {!loading && unavailable && (
        <PanelMessage>
          Your program summary isn&apos;t available for this account.
        </PanelMessage>
      )}
      {!loading && progress && progress.programs.length === 0 && (
        <PanelMessage>No program enrollments yet.</PanelMessage>
      )}
      {progress && progress.programs.length > 0 && (
        <ul className="space-y-4">
          {progress.programs.map((p) => (
            <li
              key={p.enrollmentId}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
                  {programGlyph(p.programName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-slate-900">
                    {p.programName}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={p.enrollmentStatus} />
                  </div>
                </div>
              </div>
              <dl className="mt-4 space-y-3 text-xs">
                {[
                  {
                    label: "Average score",
                    value: p.exams.averageScorePct,
                    detail: `${p.exams.graded} graded`,
                  },
                  {
                    label: "Pass rate",
                    value: p.exams.passRate,
                    detail: `${p.exams.graded} graded`,
                  },
                  {
                    label: "Attendance (present)",
                    value: p.attendance.attendanceRate,
                    detail: `${p.attendance.present} of ${p.attendance.totalSessions}`,
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-600">{m.label}</dt>
                      <dd className="tabular-nums text-slate-500">
                        <span className="font-bold text-slate-900">
                          {m.value === null ? "—" : `${Math.round(m.value)}%`}
                        </span>{" "}
                        · {m.detail}
                      </dd>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 rounded-full bg-slate-100"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-red-700"
                        style={{ width: `${m.value ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

type HistoryFilter = "all" | "passed" | "below" | "pending";

function History({ attempts }: { attempts: AttemptSummary[] }) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const sorted = attempts
    .slice()
    .sort((a, b) =>
      (a.submittedAt ?? a.startedAt) < (b.submittedAt ?? b.startedAt) ? 1 : -1,
    );
  const kind = (a: AttemptSummary): HistoryFilter =>
    isGraded(a) ? (a.passed ? "passed" : "below") : "pending";
  const counts = {
    all: sorted.length,
    passed: 0,
    below: 0,
    pending: 0,
  } as Record<HistoryFilter, number>;
  sorted.forEach((a) => (counts[kind(a)] += 1));
  const filtered = sorted.filter((a) => filter === "all" || kind(a) === filter);
  const shown = expanded ? filtered : filtered.slice(0, 8);

  const tabs: { key: HistoryFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "passed", label: "Passed" },
    { key: "below", label: "Below passing" },
    { key: "pending", label: "In progress / awaiting" },
  ];

  return (
    <section aria-labelledby="history-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <h2
          id="history-heading"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-wide text-slate-900"
        >
          <span className="text-red-700">{icons.schedule}</span>
          Exam History
          <span className="text-sm font-normal text-slate-400">
            · {sorted.length}
          </span>
        </h2>
      </div>
      <div
        className="mb-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter exam history"
      >
        {tabs.map((t) => {
          const selected = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setFilter(t.key);
                setExpanded(false);
              }}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                selected
                  ? "border-red-700 bg-red-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {t.label}
              <span
                className={`tabular-nums ${selected ? "text-red-100" : "text-slate-400"}`}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <PanelMessage>No attempts in this group.</PanelMessage>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
          {shown.map((a) => {
            const g = isGraded(a) ? toGraded(a) : null;
            const when = new Date(a.submittedAt ?? a.startedAt);
            const statusLabel = g
              ? a.passed
                ? "Passed"
                : "Below passing"
              : a.status === "IN_PROGRESS"
                ? "In progress"
                : "Awaiting results";
            const chip = g
              ? a.passed
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-900"
              : a.status === "IN_PROGRESS"
                ? "bg-blue-50 text-blue-800"
                : "bg-violet-50 text-violet-800";
            return (
              <li key={a.id}>
                <Link
                  href={`/student/exams/${a.examId}/attempt/${a.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700 sm:gap-4 sm:px-5"
                >
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50 leading-none">
                    <span className="text-[10px] font-semibold uppercase text-slate-500">
                      {when.toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-900">
                      {when.getDate()}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {a.exam.title}
                      </span>
                    </span>
                    {g ? (
                      <span className="mt-1.5 flex items-center gap-3">
                        <span className="flex-1">
                          <ScoreBar
                            pct={g.pct}
                            passPct={g.passPct}
                            passed={Boolean(a.passed)}
                          />
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          <span className="font-bold text-slate-900">
                            {g.pct}%
                          </span>{" "}
                          · {a.score}/{a.maxScore}
                        </span>
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {a.status === "IN_PROGRESS"
                          ? "Started, not yet submitted"
                          : "Submitted, score appears once graded"}
                      </span>
                    )}
                  </span>
                  <span
                    className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${chip}`}
                  >
                    {statusLabel}
                  </span>
                  <span
                    className="shrink-0 text-slate-300 [&_svg]:h-4 [&_svg]:w-4"
                    aria-hidden
                  >
                    {icons.arrowRight}
                  </span>
                  <span className="sr-only">{statusLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {filtered.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          {expanded ? "Show fewer" : `Show all ${filtered.length} attempts`}
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StudentProgressPage() {
  const attempts = useMyAttempts();
  const profile = useMyStudentProfile();

  const exams = useQuery<ExamLite[]>({
    queryKey: ["exam-types"],
    queryFn: async () => (await apiClient.get<ExamLite[]>("/v1/exams")).data,
  });
  const progress = useQuery<MyProgress>({
    queryKey: ["my-progress-full"],
    enabled: Boolean(profile.data),
    retry: false,
    queryFn: async () =>
      (await apiClient.get<MyProgress>("/v1/progress/me")).data,
  });

  const all = useMemo(() => attempts.data ?? [], [attempts.data]);
  const graded = useMemo(() => all.filter(isGraded).map(toGraded), [all]);
  const typeById = useMemo(
    () => new Map((exams.data ?? []).map((e) => [e.id, e.type])),
    [exams.data],
  );
  const typeOf = (id: string) => typeById.get(id) ?? null;

  const averagePct = avg(graded.map((a) => a.pct));
  const passRate = graded.length
    ? Math.round((graded.filter((a) => a.passed).length / graded.length) * 100)
    : null;
  const examsTaken = new Set(all.map((a) => a.examId)).size;
  const attendance = progress.data?.overall.attendanceRate ?? null;
  const dash = <span className="text-slate-300">—</span>;
  const ready = Boolean(attempts.data);

  return (
    <StudentShell>
      <StudentPageHero
        badge={icons.progress}
        title="Performance"
        meta={<span>Your exam results and progress over time.</span>}
      >
        <HeroFigure
          icon={icons.progress}
          tone="bg-red-50 text-red-700"
          value={ready && averagePct !== null ? `${averagePct}%` : dash}
          label="Average score"
        />
        <HeroFigure
          icon={icons.quiz}
          tone="bg-emerald-50 text-emerald-700"
          value={ready && passRate !== null ? `${passRate}%` : dash}
          label="Pass rate"
        />
        <HeroFigure
          icon={icons.exams}
          tone="bg-blue-50 text-blue-700"
          value={ready ? graded.length : dash}
          label={`Graded · ${ready ? examsTaken : "—"} ${examsTaken === 1 ? "exam" : "exams"} taken`}
        />
        <HeroFigure
          icon={icons.schedule}
          tone="bg-amber-50 text-amber-700"
          value={attendance === null ? dash : `${Math.round(attendance)}%`}
          label={
            progress.isError ? "Attendance unavailable" : "Attendance (present)"
          }
        />
      </StudentPageHero>

      {attempts.isLoading && <SkeletonRows count={3} className="h-40" />}
      {attempts.isError && (
        <PanelMessage tone="error">
          Couldn&apos;t load your exam history. Refresh the page to try again.
        </PanelMessage>
      )}
      {ready && all.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">
            {icons.progress}
          </span>
          <span className="font-semibold text-slate-700">No attempts yet</span>
          <span>
            Exams you take will show up here with your results and trends.
          </span>
          <Link
            href="/student/practice-exams"
            className="font-semibold text-red-700 underline underline-offset-4"
          >
            Take a practice exam
          </Link>
        </PanelMessage>
      )}

      {ready && all.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="grid min-w-0 grid-cols-1 gap-5">
            <ScoreTrend
              attempts={all}
              loading={false}
              error={false}
              limit={24}
              height={260}
            />
            <ByType graded={graded} typeOf={typeOf} />
            <History attempts={all} />
          </div>
          <aside
            className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1"
            aria-label="Focus and programs"
          >
            <FocusPanel graded={graded} />
            <ProgramsPanel
              progress={progress.data}
              loading={progress.isLoading}
              unavailable={progress.isError}
            />
            <p className="px-1 text-[11px] leading-relaxed text-slate-400 md:col-span-2 xl:col-span-1">
              Attendance is the share of recorded sessions marked present, the same figure your instructors see.{" "}
              <PanelLink href="/student/schedule">
                See attendance details
              </PanelLink>
            </p>
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
