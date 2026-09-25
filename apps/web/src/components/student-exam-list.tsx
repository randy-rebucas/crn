'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { type AttemptSummary, pickActiveEnrollment, useMyAttempts, useMyEnrollments } from '@/lib/student-hooks';
import {
  HeroFigure,
  Panel,
  PanelLink,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
} from '@/components/student-ui';

export type ExamType = 'PRACTICE' | 'DIAGNOSTIC' | 'MOCK' | 'FINAL';

interface ExamItem {
  id: string;
  title: string;
  type: ExamType;
  status: string;
  programId: string | null;
  attemptLimit: number;
  timeLimitMinutes: number | null;
  passingScore: number;
  resultRelease?: string;
  _count?: { questions: number };
}

// One catalog, three entry points: /student/exams (every type),
// /student/practice-exams (MOCK + FINAL — full-length board simulations)
// and /student/quizzes (PRACTICE + DIAGNOSTIC — shorter checks). The API
// scopes GET /v1/exams to PUBLISHED for students but has no program or type
// filter, so both narrow client-side.
//
// Standing comes from GET /v1/attempts/me (self-scoped). Delayed-release
// results arrive status-only until graded, so a submitted-but-ungraded
// attempt reads as "Awaiting results", never as a score.

export const examGlyphs = {
  target: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={12} cy={12} r={4.5} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={12} cy={12} r={1} fill="currentColor" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <circle cx={4.5} cy={6.5} r={1.2} fill="currentColor" />
      <circle cx={4.5} cy={12} r={1.2} fill="currentColor" />
      <circle cx={4.5} cy={17.5} r={1.2} fill="currentColor" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M5.5 20.5v-16M5.5 4.5h11l-2.2 4 2.2 4h-11" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export const TYPE_META: Record<ExamType, { label: string; section: string; hint: string; icon: React.ReactNode; tone: string }> = {
  MOCK: {
    label: 'Mock board',
    section: 'Mock Board Exams',
    hint: 'Full-length simulations of the licensure exam',
    icon: icons.practice,
    tone: 'bg-red-50 text-red-700',
  },
  FINAL: {
    label: 'Final',
    section: 'Final Exams',
    hint: 'End-of-program exams',
    icon: icons.certificate,
    tone: 'bg-amber-50 text-amber-700',
  },
  PRACTICE: {
    label: 'Practice',
    section: 'Practice Quizzes',
    hint: 'Checks you can use to drill a topic',
    icon: icons.quiz,
    tone: 'bg-blue-50 text-blue-700',
  },
  DIAGNOSTIC: {
    label: 'Diagnostic',
    section: 'Diagnostic Tests',
    hint: 'Find the areas that need the most review',
    icon: examGlyphs.target,
    tone: 'bg-violet-50 text-violet-700',
  },
};

const TYPE_ORDER: ExamType[] = ['MOCK', 'FINAL', 'PRACTICE', 'DIAGNOSTIC'];

// ---------------------------------------------------------------------------
// Per-exam standing
// ---------------------------------------------------------------------------

type ExamState = 'todo' | 'in-progress' | 'awaiting' | 'passed' | 'below' | 'locked';

interface Standing {
  state: ExamState;
  used: number;
  bestPct: number | null;
  passPct: number | null;
  resumeId: string | null;
  lastAt: string | null;
}

function standingFor(exam: ExamItem, attempts: AttemptSummary[]): Standing {
  const mine = attempts.filter((a) => a.examId === exam.id);
  const graded = mine.filter((a) => a.status === 'GRADED' && a.score !== undefined && a.maxScore);
  const best = graded.reduce<AttemptSummary | null>((b, a) => (!b || a.score! / a.maxScore! > b.score! / b.maxScore! ? a : b), null);
  const inProgress = mine.find((a) => a.status === 'IN_PROGRESS');
  const awaiting = mine.some((a) => a.status === 'SUBMITTED');
  const passed = graded.some((a) => a.passed);
  const atLimit = mine.length >= exam.attemptLimit;
  const lastAt = mine.map((a) => a.submittedAt ?? a.startedAt).sort().at(-1) ?? null;

  let state: ExamState = 'todo';
  if (inProgress) state = 'in-progress';
  else if (passed) state = 'passed';
  else if (awaiting) state = 'awaiting';
  else if (graded.length > 0) state = atLimit ? 'locked' : 'below';
  else if (atLimit) state = 'locked';

  return {
    state,
    used: mine.length,
    bestPct: best ? Math.round((best.score! / best.maxScore!) * 100) : null,
    passPct: best ? Math.min(100, Math.round((exam.passingScore / best.maxScore!) * 100)) : null,
    resumeId: inProgress?.id ?? null,
    lastAt,
  };
}

const STATE_META: Record<ExamState, { label: string; chip: string; icon: React.ReactNode }> = {
  todo: { label: 'Not started', chip: 'bg-slate-100 text-slate-700', icon: examGlyphs.flag },
  'in-progress': { label: 'In progress', chip: 'bg-blue-50 text-blue-800', icon: examGlyphs.clock },
  awaiting: { label: 'Awaiting results', chip: 'bg-violet-50 text-violet-800', icon: examGlyphs.clock },
  passed: { label: 'Passed', chip: 'bg-emerald-50 text-emerald-800', icon: icons.quiz },
  below: { label: 'Below passing', chip: 'bg-amber-50 text-amber-900', icon: icons.help },
  locked: { label: 'No attempts left', chip: 'bg-slate-100 text-slate-600', icon: icons.close },
};

type Filter = 'all' | 'todo' | 'in-progress' | 'passed' | 'below';

const FILTERS: { key: Filter; label: string; match: (s: ExamState) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'todo', label: 'To do', match: (s) => s === 'todo' },
  { key: 'in-progress', label: 'In progress', match: (s) => s === 'in-progress' || s === 'awaiting' },
  { key: 'passed', label: 'Passed', match: (s) => s === 'passed' },
  { key: 'below', label: 'Below passing', match: (s) => s === 'below' || s === 'locked' },
];

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Exam card
// ---------------------------------------------------------------------------

function AttemptDots({ used, limit }: { used: number; limit: number }) {
  if (limit > 6) {
    return (
      <span className="tabular-nums">
        {used}/{limit} attempts
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex gap-1" aria-hidden>
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i < used ? 'bg-red-700' : 'bg-slate-200'}`} />
        ))}
      </span>
      <span className="tabular-nums">
        {used}/{limit} {limit === 1 ? 'attempt' : 'attempts'}
      </span>
    </span>
  );
}

function ScoreBar({ best, pass, passed }: { best: number; pass: number; passed: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-500">Best score</span>
        <span className="tabular-nums">
          <span className={`text-base font-bold ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>{best}%</span>
          <span className="text-slate-400"> / pass {pass}%</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden>
        <div className={`h-full rounded-full ${passed ? 'bg-emerald-600' : 'bg-amber-500'}`} style={{ width: `${Math.max(best, 2)}%` }} />
        <span className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-slate-900" style={{ left: `calc(${pass}% - 1px)` }} />
      </div>
    </div>
  );
}

function ExamCard({ exam, standing }: { exam: ExamItem; standing: Standing }) {
  const type = TYPE_META[exam.type];
  const state = STATE_META[standing.state];
  const questions = exam._count?.questions;
  const href = standing.resumeId ? `/student/exams/${exam.id}/attempt/${standing.resumeId}` : `/student/exams/${exam.id}`;
  const cta =
    standing.state === 'in-progress'
      ? 'Resume'
      : standing.state === 'todo'
        ? 'Start exam'
        : standing.state === 'below'
          ? 'Retake'
          : 'View details';
  const primary = standing.state === 'todo' || standing.state === 'in-progress' || standing.state === 'below';

  return (
    <li className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:border-slate-300 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[22px] [&_svg]:w-[22px] ${type.tone}`}>{type.icon}</span>
        <h3 className="min-w-0 flex-1 pt-0.5 text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] line-clamp-2">{exam.title}</h3>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <li>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5 ${state.chip}`}>
            <span aria-hidden>{state.icon}</span>
            {state.label}
          </span>
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="text-slate-400">{examGlyphs.clock}</span>
          {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : 'Untimed'}
        </li>
        {questions !== undefined && (
          <li className="inline-flex items-center gap-1.5">
            <span className="text-slate-400">{examGlyphs.list}</span>
            {questions} {questions === 1 ? 'question' : 'questions'}
          </li>
        )}
        <li className="inline-flex items-center gap-1.5">
          <span className="text-slate-400">{examGlyphs.flag}</span>
          Pass at {exam.passingScore} pts
        </li>
      </ul>

      <div className="mt-4 flex-1">
        {standing.bestPct !== null && standing.passPct !== null ? (
          <ScoreBar best={standing.bestPct} pass={standing.passPct} passed={standing.state === 'passed'} />
        ) : standing.state === 'awaiting' ? (
          <p className="rounded-lg bg-violet-50/60 px-3 py-2 text-xs text-violet-900">Submitted. Your score appears once it&apos;s graded.</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <AttemptDots used={standing.used} limit={exam.attemptLimit} />
        <Link
          href={href}
          className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
            primary ? 'bg-red-700 text-white hover:bg-red-800' : 'border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {cta}
          <span className="sr-only">: {exam.title}</span>
          {icons.arrowRight}
        </Link>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Rail: best score per attempted exam vs. its passing mark, and recent attempts
// ---------------------------------------------------------------------------

function BestScores({ rows }: { rows: { exam: ExamItem; standing: Standing }[] }) {
  const scored = rows.filter((r) => r.standing.bestPct !== null && r.standing.passPct !== null);

  return (
    <Panel title="Best Scores" icon={icons.progress} action={<PanelLink href="/student/progress">Performance</PanelLink>}>
      {scored.length === 0 ? (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icons.progress}</span>
          <span>Your best score on each exam charts here once an attempt is graded.</span>
        </PanelMessage>
      ) : (
        <figure>
          <figcaption className="sr-only">
            Best score per exam against its passing mark:{' '}
            {scored.map((r) => `${r.exam.title} ${r.standing.bestPct}% (passing ${r.standing.passPct}%)`).join('; ')}
          </figcaption>
          <ul className="space-y-3.5" aria-hidden>
            {scored.map(({ exam, standing }) => {
              const passed = standing.state === 'passed';
              return (
                <li key={exam.id}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-medium text-slate-700">{exam.title}</span>
                    <span className={`shrink-0 font-bold tabular-nums ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>{standing.bestPct}%</span>
                  </div>
                  <div className="relative mt-1.5 h-2.5 rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${passed ? 'bg-emerald-600' : 'bg-amber-500'}`}
                      style={{ width: `${Math.max(standing.bestPct!, 2)}%` }}
                    />
                    <span className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-slate-900" style={{ left: `calc(${standing.passPct}% - 1px)` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-emerald-600" aria-hidden /> Passed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-amber-500" aria-hidden /> Below passing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-0.5 rounded-full bg-slate-900" aria-hidden /> Passing mark
            </span>
          </div>
        </figure>
      )}
    </Panel>
  );
}

function RecentAttempts({ attempts, exams }: { attempts: AttemptSummary[]; exams: Map<string, ExamItem> }) {
  const recent = attempts
    .filter((a) => exams.has(a.examId))
    .sort((a, b) => ((a.submittedAt ?? a.startedAt) < (b.submittedAt ?? b.startedAt) ? 1 : -1))
    .slice(0, 5);

  return (
    <Panel title="Recent Attempts" icon={examGlyphs.clock}>
      {recent.length === 0 ? (
        <PanelMessage>No attempts yet. Your first one will show up here.</PanelMessage>
      ) : (
        <ul className="-mx-2 divide-y divide-slate-100">
          {recent.map((a) => {
            const graded = a.status === 'GRADED' && a.score !== undefined && a.maxScore;
            const pct = graded ? Math.round((a.score! / a.maxScore!) * 100) : null;
            const href = a.status === 'IN_PROGRESS' ? `/student/exams/${a.examId}/attempt/${a.id}` : `/student/exams/${a.examId}`;
            return (
              <li key={a.id}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                >
                  <span
                    className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                      pct === null ? 'bg-slate-100 text-slate-500' : a.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    {pct === null ? (a.status === 'IN_PROGRESS' ? 'Open' : '—') : `${pct}%`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{a.exam.title}</span>
                    <span className="block text-xs text-slate-500">
                      {a.status === 'IN_PROGRESS'
                        ? 'In progress'
                        : a.status === 'SUBMITTED'
                          ? 'Awaiting results'
                          : a.passed
                            ? 'Passed'
                            : 'Below passing'}{' '}
                      · {shortDate(a.submittedAt ?? a.startedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export function ExamCatalog({
  types,
  title,
  description,
  icon = icons.exams,
  emptyTitle = 'No exams available',
}: {
  types?: ExamType[];
  title: string;
  description: string;
  icon?: React.ReactNode;
  emptyTitle?: string;
}) {
  const enrollments = useMyEnrollments();
  const active = pickActiveEnrollment(enrollments.data);
  const myAttempts = useMyAttempts();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const exams = useQuery<ExamItem[]>({
    queryKey: ['exams-for-program', active?.programId],
    enabled: Boolean(active),
    queryFn: async () => {
      const { data } = await apiClient.get<ExamItem[]>('/v1/exams');
      return data.filter((e) => !e.programId || e.programId === active!.programId);
    },
  });

  const rows = useMemo(
    () =>
      (exams.data ?? [])
        .filter((e) => !types || types.includes(e.type))
        .map((exam) => ({ exam, standing: standingFor(exam, myAttempts.data ?? []) })),
    [exams.data, types, myAttempts.data],
  );
  const examById = useMemo(() => new Map(rows.map((r) => [r.exam.id, r.exam])), [rows]);

  const q = query.trim().toLowerCase();
  const matchFilter = FILTERS.find((f) => f.key === filter)!.match;
  const visible = rows.filter((r) => matchFilter(r.standing.state) && (!q || r.exam.title.toLowerCase().includes(q)));
  const sections = TYPE_ORDER.filter((t) => !types || types.includes(t))
    .map((t) => ({ type: t, rows: visible.filter((r) => r.exam.type === t) }))
    .filter((s) => s.rows.length > 0);

  const attempted = rows.filter((r) => r.standing.used > 0).length;
  const passedCount = rows.filter((r) => r.standing.state === 'passed').length;
  const scored = rows.filter((r) => r.standing.bestPct !== null);
  const avgBest = scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.standing.bestPct!, 0) / scored.length) : null;
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => f.match(r.standing.state)).length])) as Record<Filter, number>;

  const ready = Boolean(active && exams.data);
  const filtering = filter !== 'all' || Boolean(q);
  const dash = <span className="text-slate-300">—</span>;
  const clear = () => {
    setFilter('all');
    setQuery('');
  };

  return (
    <StudentShell>
      <StudentPageHero badge={icon} title={title} meta={<span>{description}</span>}>
        <HeroFigure icon={icons.exams} tone="bg-red-50 text-red-700" value={ready ? rows.length : dash} label="Available to you" />
        <HeroFigure icon={examGlyphs.flag} tone="bg-blue-50 text-blue-700" value={ready ? attempted : dash} label="Attempted" />
        <HeroFigure icon={icons.quiz} tone="bg-emerald-50 text-emerald-700" value={ready ? passedCount : dash} label="Passed" />
        <HeroFigure
          icon={icons.progress}
          tone="bg-amber-50 text-amber-700"
          value={ready && avgBest !== null ? `${avgBest}%` : dash}
          label="Average best score"
        />
      </StudentPageHero>

      {enrollments.isLoading && <SkeletonRows count={3} className="h-40" />}
      {enrollments.isError && <PanelMessage tone="error">Couldn&apos;t load your enrollment. Refresh the page to try again.</PanelMessage>}
      {!enrollments.isLoading && !enrollments.isError && !active && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icon}</span>
          <span className="font-semibold text-slate-700">No active program</span>
          <span>Exams appear here once you&apos;re enrolled in a program.</span>
        </PanelMessage>
      )}
      {active && exams.isLoading && <SkeletonRows count={3} className="h-40" />}
      {active && exams.isError && <PanelMessage tone="error">Couldn&apos;t load exams. Refresh the page to try again.</PanelMessage>}
      {ready && rows.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icon}</span>
          <span className="font-semibold text-slate-700">{emptyTitle}</span>
          <span>Nothing of this kind has been published for your program yet.</span>
        </PanelMessage>
      )}

      {ready && rows.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="min-w-0">
            <div className="mb-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block flex-1">
                  <span className="sr-only">Search exams</span>
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search exams by title"
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
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                {FILTERS.map((f) => {
                  const selected = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setFilter(f.key)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                        selected ? 'border-red-700 bg-red-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {f.label}
                      <span className={`tabular-nums ${selected ? 'text-red-100' : 'text-slate-400'}`}>{counts[f.key]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="sr-only" aria-live="polite">
                {filtering ? `${visible.length} of ${rows.length} exams shown` : ''}
              </p>
            </div>

            {visible.length === 0 && (
              <PanelMessage>
                <span>No exams match these filters.</span>
                <button type="button" onClick={clear} className="font-semibold text-red-700 underline underline-offset-4">
                  Show all exams
                </button>
              </PanelMessage>
            )}

            <div className="space-y-8">
              {sections.map((s) => {
                const meta = TYPE_META[s.type];
                return (
                  <section key={s.type} aria-labelledby={`exams-${s.type}`}>
                    <div className="mb-3 flex items-center gap-3 px-1">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5 ${meta.tone}`}>{meta.icon}</span>
                      <div className="min-w-0">
                        <h2 id={`exams-${s.type}`} className="text-lg font-semibold tracking-wide text-slate-900">
                          {meta.section} <span className="text-sm font-normal text-slate-400">· {s.rows.length}</span>
                        </h2>
                        <p className="text-xs text-slate-500">{meta.hint}</p>
                      </div>
                    </div>
                    <ul className="grid gap-4 lg:grid-cols-2">
                      {s.rows.map(({ exam, standing }) => (
                        <ExamCard key={exam.id} exam={exam} standing={standing} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>

          <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1" aria-label="Your results">
            {myAttempts.isLoading ? (
              <SkeletonRows count={2} className="h-48" />
            ) : myAttempts.isError ? (
              <PanelMessage tone="error">Couldn&apos;t load your attempts.</PanelMessage>
            ) : (
              <>
                <BestScores rows={rows} />
                <RecentAttempts attempts={myAttempts.data ?? []} exams={examById} />
              </>
            )}
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
