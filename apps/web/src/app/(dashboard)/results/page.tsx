'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiClient } from '@/lib/api-client';
import { humanize } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

interface Exam {
  id: string;
  title: string;
  type: 'PRACTICE' | 'DIAGNOSTIC' | 'MOCK' | 'FINAL';
  passingScore: number;
  attemptLimit: number;
  timeLimitMinutes: number | null;
  resultRelease: 'IMMEDIATE' | 'DELAYED';
  status: string;
  createdAt: string;
}

interface Attempt {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  student: { id: string; user: { firstName: string; lastName: string } };
}

interface ExamPerformanceRow {
  examId: string;
  attempts: number;
  averageScorePct: number | null;
  passRate: number | null;
}

type ResultFilter = 'all' | 'passed' | 'failed' | 'grading' | 'in_progress';
type SortKey = 'score' | 'recent' | 'name';

const TYPE_TONES: Record<Exam['type'], string> = {
  FINAL: 'bg-red-100 text-red-700',
  MOCK: 'bg-amber-100 text-amber-800',
  DIAGNOSTIC: 'bg-slate-900 text-white',
  PRACTICE: 'bg-slate-100 text-slate-700',
};

const COLORS = { pass: '#059669', fail: '#b91c1c', grid: '#f1f5f9', axis: '#64748b', line: '#0f172a' };

function nameOf(a: Attempt) {
  return `${a.student.user.firstName} ${a.student.user.lastName}`.trim();
}

function pctOf(a: Attempt) {
  return a.score != null && a.maxScore ? Math.round((a.score / a.maxScore) * 1000) / 10 : null;
}

function duration(a: Attempt) {
  if (!a.submittedAt) return null;
  const minutes = Math.round((new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 60_000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function TypeBadge({ type }: { type: Exam['type'] }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_TONES[type]}`}>
      {humanize(type)}
    </span>
  );
}

function ResultPill({ passed }: { passed: boolean | null }) {
  if (passed === null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${passed ? 'bg-emerald-600' : 'bg-red-600'}`} />
      {passed ? 'Passed' : 'Failed'}
    </span>
  );
}

function downloadCsv(exam: Exam, attempts: Attempt[]) {
  const escape = (v: string | number | null) => {
    let s = v == null ? '' : String(v);
    // Text cells starting with = + - @ (or a tab/CR) run as formulas when the
    // file is opened in Excel or Sheets, and student names are user input —
    // prefix them with ' so they're read as plain text.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    ['Student', 'Status', 'Score', 'Max score', 'Percent', 'Result', 'Started', 'Submitted'],
    ...attempts.map((a) => [
      nameOf(a),
      humanize(a.status),
      a.score,
      a.maxScore,
      pctOf(a),
      a.passed == null ? '' : a.passed ? 'Passed' : 'Failed',
      new Date(a.startedAt).toISOString(),
      a.submittedAt ? new Date(a.submittedAt).toISOString() : '',
    ]),
  ];
  const csv = rows.map((r) => r.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${exam.title.replace(/[^\w-]+/g, '_')}_results.csv`;
  link.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ---------------------------------------------------------------------------
// Exam detail

function ExamResults({ exam }: { exam: Exam }) {
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [sort, setSort] = useState<SortKey>('score');
  const [search, setSearch] = useState('');
  const [latestOnly, setLatestOnly] = useState(true);

  const { data, isLoading, isError } = useQuery<Attempt[]>({
    queryKey: ['attempts', exam.id],
    queryFn: async () => (await apiClient.get('/v1/attempts', { params: { examId: exam.id } })).data,
  });
  const attempts = useMemo(() => data ?? [], [data]);
  const examDetailQuery = useQuery<{ questions: { points: number }[] }>({
    queryKey: ['exams', exam.id],
    queryFn: async () => (await apiClient.get(`/v1/exams/${exam.id}`)).data,
  });

  // Attempts come newest-first, so the first one per student is their latest.
  const attemptNumber = useMemo(() => {
    const byStudent = new Map<string, Attempt[]>();
    for (const a of attempts) byStudent.set(a.student.id, [...(byStudent.get(a.student.id) ?? []), a]);
    const numbers = new Map<string, { n: number; of: number; latest: boolean }>();
    for (const list of byStudent.values()) {
      list.forEach((a, i) => numbers.set(a.id, { n: list.length - i, of: list.length, latest: i === 0 }));
    }
    return numbers;
  }, [attempts]);

  const graded = attempts.filter((a) => a.status === 'GRADED');
  const scored = graded.map(pctOf).filter((p): p is number => p !== null);
  const students = new Set(attempts.map((a) => a.student.id)).size;
  const passed = graded.filter((a) => a.passed).length;
  const awaiting = attempts.filter((a) => a.status === 'SUBMITTED').length;
  const inProgress = attempts.filter((a) => a.status === 'IN_PROGRESS').length;
  const average = scored.length ? Math.round((scored.reduce((s, p) => s + p, 0) / scored.length) * 10) / 10 : null;
  const top = scored.length ? Math.max(...scored) : null;
  // Pass mark as a percentage of what the exam is actually worth (sum of its
  // question points); falls back to a graded attempt's maxScore if the exam
  // detail isn't readable.
  const totalPoints = examDetailQuery.data?.questions.reduce((s, q) => s + q.points, 0) || null;
  const typicalMax = totalPoints ?? graded.find((a) => a.maxScore)?.maxScore ?? null;
  const passPct = typicalMax ? Math.min(100, Math.round((exam.passingScore / typicalMax) * 100)) : null;

  const histogram = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${i === 9 ? 100 : i * 10 + 9}`,
    from: i * 10,
    count: 0,
  }));
  for (const p of scored) histogram[Math.min(9, Math.floor(p / 10))].count += 1;

  const counts: Record<ResultFilter, number> = {
    all: attempts.length,
    passed: graded.filter((a) => a.passed).length,
    failed: graded.filter((a) => a.passed === false).length,
    grading: awaiting,
    in_progress: inProgress,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = attempts.filter((a) => {
      if (latestOnly && !attemptNumber.get(a.id)?.latest) return false;
      if (q && !nameOf(a).toLowerCase().includes(q)) return false;
      if (filter === 'passed') return a.passed === true;
      if (filter === 'failed') return a.passed === false;
      if (filter === 'grading') return a.status === 'SUBMITTED';
      if (filter === 'in_progress') return a.status === 'IN_PROGRESS';
      return true;
    });
    return rows.sort((a, b) => {
      if (sort === 'name') return nameOf(a).localeCompare(nameOf(b));
      if (sort === 'recent') return (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt);
      return (pctOf(b) ?? -1) - (pctOf(a) ?? -1);
    });
  }, [attempts, filter, search, sort, latestOnly, attemptNumber]);

  const hasRetakes = Array.from(attemptNumber.values()).some((v) => v.of > 1);

  const tiles = [
    { label: 'Students', value: String(students), detail: `${attempts.length} attempt${attempts.length === 1 ? '' : 's'}`, icon: adminIcons.users, tone: 'bg-slate-900 text-white' },
    { label: 'Average score', value: average == null ? '—' : `${average}%`, detail: top == null ? 'No graded attempts' : `Top score ${top}%`, icon: adminIcons.barChart, tone: 'bg-amber-400 text-slate-900' },
    {
      label: 'Pass rate',
      value: graded.length ? `${Math.round((passed / graded.length) * 100)}%` : '—',
      detail: `${passed} of ${graded.length} graded passed`,
      icon: adminIcons.checkSquare,
      tone: 'bg-emerald-600 text-white',
    },
    {
      label: 'Awaiting grading',
      value: String(awaiting),
      detail: inProgress ? `${inProgress} still in progress` : 'None in progress',
      icon: adminIcons.clipboardCheck,
      tone: awaiting > 0 ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-600',
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{exam.title}</h2>
              <TypeBadge type={exam.type} />
              {exam.status !== 'PUBLISHED' && <StatusBadge status={exam.status} />}
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <div>
                <dt className="inline">Pass mark </dt>
                <dd className="inline font-medium text-slate-700">
                  {exam.passingScore} pts{passPct != null && ` (${passPct}%)`}
                </dd>
              </div>
              <div>
                <dt className="inline">Attempts allowed </dt>
                <dd className="inline font-medium text-slate-700">{exam.attemptLimit}</dd>
              </div>
              {exam.timeLimitMinutes && (
                <div>
                  <dt className="inline">Time limit </dt>
                  <dd className="inline font-medium text-slate-700">{exam.timeLimitMinutes} min</dd>
                </div>
              )}
              <div>
                <dt className="inline">Results </dt>
                <dd className="inline font-medium text-slate-700">
                  {exam.resultRelease === 'IMMEDIATE' ? 'shown right away' : 'released later'}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex gap-2">
            {awaiting > 0 && (
              <Link
                href="/exams"
                className="inline-flex items-center rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Grade {awaiting} in Exams
              </Link>
            )}
            <Button
              variant="secondary"
              disabled={attempts.length === 0}
              onClick={() => downloadCsv(exam, attempts)}
              className="inline-flex items-center gap-1.5"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {isError && <ErrorState message="Couldn't load results for this exam. Refresh the page to try again." />}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}
      {data && attempts.length === 0 && (
        <EmptyState
          title="No attempts yet"
          description={exam.status === 'PUBLISHED' ? 'Results will appear here once students take this exam.' : 'This exam isn’t published, so students can’t take it yet.'}
        />
      )}

      {attempts.length > 0 && (
        <>
          <section aria-label="Exam summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label} className="flex items-center gap-4 p-5">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.tone}`} aria-hidden="true">
                  {t.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{t.label}</p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">{t.value}</p>
                  <p className="truncate text-xs text-slate-500">{t.detail}</p>
                </div>
              </Card>
            ))}
          </section>

          {scored.length > 0 && (
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Score distribution</h3>
                  <p className="text-xs text-slate-500">Graded attempts by percentage score</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> At or above pass mark
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-700" /> Below
                  </span>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogram} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={COLORS.grid} />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: COLORS.axis }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.axis }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                      formatter={(v) => [v, 'Attempts']}
                      labelFormatter={(l) => `${l}%`}
                    />
                    {passPct != null && (
                      <ReferenceLine
                        x={histogram[Math.min(9, Math.floor(passPct / 10))].range}
                        stroke={COLORS.line}
                        strokeDasharray="4 3"
                        label={{ value: `Pass ${passPct}%`, position: 'top', fontSize: 11, fill: COLORS.line }}
                      />
                    )}
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {histogram.map((b) => (
                        <Cell key={b.range} fill={passPct != null && b.from + 9 < passPct ? COLORS.fail : COLORS.pass} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter results">
                {(
                  [
                    ['all', 'All'],
                    ['passed', 'Passed'],
                    ['failed', 'Failed'],
                    ['grading', 'Needs grading'],
                    ['in_progress', 'In progress'],
                  ] as [ResultFilter, string][]
                ).map(([id, label]) => {
                  const active = filter === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                        active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                      <span className={`ml-1.5 tabular-nums ${active ? 'text-red-100' : 'text-slate-400'}`}>{counts[id]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {hasRetakes && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={latestOnly}
                      onChange={(e) => setLatestOnly(e.target.checked)}
                      className="h-4 w-4 accent-red-700"
                    />
                    Latest attempt only
                  </label>
                )}
                <label className="block">
                  <span className="sr-only">Sort by</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-red-600 focus:outline-none"
                  >
                    <option value="score">Highest score</option>
                    <option value="recent">Most recent</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </label>
                <label className="relative block sm:w-56">
                  <span className="sr-only">Search students</span>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{baseIcons.search}</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search students"
                    className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
                  />
                </label>
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="px-4 py-14 text-center text-sm text-slate-500">
                No results match.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSearch('');
                  }}
                  className="font-medium text-red-700 hover:underline"
                >
                  Clear filters
                </button>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {sort === 'score' && <th scope="col" className="w-12 px-4 py-3 font-medium">#</th>}
                      <th scope="col" className="px-4 py-3 font-medium">Student</th>
                      <th scope="col" className="w-56 px-4 py-3 font-medium">Score</th>
                      <th scope="col" className="px-4 py-3 font-medium">Result</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((a, i) => {
                      const pct = pctOf(a);
                      const num = attemptNumber.get(a.id);
                      const time = duration(a);
                      return (
                        <tr key={a.id} className="transition-colors hover:bg-slate-50">
                          {sort === 'score' && (
                            <td className="px-4 py-3 tabular-nums text-slate-400">{pct == null ? '—' : i + 1}</td>
                          )}
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{nameOf(a)}</p>
                            {num && num.of > 1 && (
                              <p className="text-xs text-slate-500">
                                Attempt {num.n} of {num.of}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {pct == null ? (
                              <span className="text-xs text-slate-400">{a.status === 'SUBMITTED' ? 'Waiting to be graded' : 'Not submitted'}</span>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, backgroundColor: a.passed ? COLORS.pass : COLORS.fail }}
                                  />
                                  {passPct != null && (
                                    <span className="absolute inset-y-0 w-px bg-slate-900/60" style={{ left: `${passPct}%` }} aria-hidden="true" />
                                  )}
                                </div>
                                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-slate-700">
                                  <span className="font-semibold">{pct}%</span>
                                  <span className="ml-1 text-slate-400">
                                    {a.score}/{a.maxScore}
                                  </span>
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ResultPill passed={a.passed} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={a.status} />
                          </td>
                          <td className="px-4 py-3">
                            {a.submittedAt ? (
                              <>
                                <p className="tabular-nums text-slate-700">
                                  {new Date(a.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                {time && <p className="text-xs text-slate-500">took {time}</p>}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Started {new Date(a.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function ResultsPage() {
  const { hasPermission } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const examsQuery = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  // Optional: per-exam attempt counts and pass rates for the exam list.
  const performanceQuery = useQuery<ExamPerformanceRow[]>({
    queryKey: ['reports', 'exam-performance'],
    queryFn: async () => (await apiClient.get('/v1/reports/exam-performance')).data,
    enabled: hasPermission('reports.view'),
  });
  const performance = useMemo(
    () => new Map((performanceQuery.data ?? []).map((r) => [r.examId, r] as const)),
    [performanceQuery.data],
  );

  const exams = useMemo(() => examsQuery.data ?? [], [examsQuery.data]);
  const visibleExams = exams.filter((e) => !search.trim() || e.title.toLowerCase().includes(search.trim().toLowerCase()));

  // Default to the exam with the most graded attempts, else the newest.
  const defaultId = useMemo(() => {
    const withAttempts = exams
      .filter((e) => (performance.get(e.id)?.attempts ?? 0) > 0)
      .sort((a, b) => (performance.get(b.id)?.attempts ?? 0) - (performance.get(a.id)?.attempts ?? 0));
    return withAttempts[0]?.id ?? exams[0]?.id ?? null;
  }, [exams, performance]);
  const activeId = selectedId ?? defaultId;
  const activeExam = exams.find((e) => e.id === activeId) ?? null;

  return (
    <div>
      <PageHeader title="Results" description="How students scored on each exam: pass rates, score spread and who still needs grading." />

      {examsQuery.isLoading && (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}
      {examsQuery.isError && <ErrorState message="Couldn't load exams. Refresh the page to try again." />}
      {examsQuery.data && exams.length === 0 && (
        <EmptyState title="No exams yet" description="Create and publish an exam under Exams; its results will show up here." />
      )}

      {exams.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="overflow-hidden lg:sticky lg:top-6">
            <div className="border-b border-slate-100 p-3">
              <label className="relative block">
                <span className="sr-only">Search exams</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{baseIcons.search}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search exams"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
                />
              </label>
            </div>
            <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto lg:max-h-[calc(100vh-14rem)]" aria-label="Exams">
              {visibleExams.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No exams match.</li>}
              {visibleExams.map((exam) => {
                const perf = performance.get(exam.id);
                const active = exam.id === activeId;
                return (
                  <li key={exam.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelectedId(exam.id)}
                      className={`w-full px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600 ${
                        active ? 'bg-red-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${active ? 'text-red-800' : 'text-slate-900'}`}>{exam.title}</p>
                        <TypeBadge type={exam.type} />
                      </div>
                      {perf ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {perf.attempts} graded
                          {perf.passRate != null && (
                            <>
                              {' · '}
                              <span className={perf.passRate >= 75 ? 'text-emerald-700' : perf.passRate >= 50 ? 'text-amber-700' : 'text-red-700'}>
                                {perf.passRate}% pass
                              </span>
                            </>
                          )}
                        </p>
                      ) : (
                        exam.status !== 'PUBLISHED' && <p className="mt-1 text-xs text-slate-400">{humanize(exam.status)}</p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {activeExam && <ExamResults key={activeExam.id} exam={activeExam} />}
        </div>
      )}
    </div>
  );
}
