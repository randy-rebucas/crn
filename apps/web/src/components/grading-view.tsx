'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { Card, Drawer, EmptyState, ErrorState, StatusBadge } from '@/components/ui';

type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_RESPONSE'
  | 'TRUE_FALSE'
  | 'IDENTIFICATION'
  | 'NUMERICAL'
  | 'ESSAY'
  | 'IMAGE_BASED';

type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

interface Exam {
  id: string;
  title: string;
  passingScore: number;
  status: string;
  program?: { id: string; name: string } | null;
  _count?: { questions: number; attempts: number };
}

interface ExamDetail extends Exam {
  questions: { questionId: string; points: number; question: { id: string; options: { id: string; text: string }[] | null } }[];
}

interface Attempt {
  id: string;
  examId: string;
  studentId: string;
  status: AttemptStatus;
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  student: { id: string; user: { firstName: string; lastName: string } };
}

interface AttemptAnswer {
  id: string;
  questionId: string;
  response: unknown;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  needsManualGrading: boolean;
  question: { id: string; content: string; type: QuestionType };
}

interface AttemptDetail extends Attempt {
  answers: AttemptAnswer[];
}

const MANUAL_TYPES = new Set<QuestionType>(['ESSAY', 'IMAGE_BASED']);

function nameOf(a: Attempt) {
  return `${a.student.user.firstName} ${a.student.user.lastName}`.trim();
}

/** Turns a stored response (option ids, booleans, text) into what the student actually chose. */
function formatResponse(response: unknown, options: { id: string; text: string }[] | null | undefined) {
  if (response === null || response === undefined || response === '') return null;
  const label = (id: unknown) => options?.find((o) => o.id === id)?.text ?? String(id);
  if (Array.isArray(response)) return response.map(label).join(', ');
  if (typeof response === 'boolean') return response ? 'True' : 'False';
  if (options?.length) return label(response);
  return typeof response === 'string' ? response : JSON.stringify(response);
}

// ---------------------------------------------------------------------------
// One answer
// ---------------------------------------------------------------------------

function AnswerCard({
  index,
  answer,
  maxPoints,
  options,
  onGrade,
  busy,
}: {
  index: number;
  answer: AttemptAnswer;
  maxPoints: number;
  options: { id: string; text: string }[] | null | undefined;
  onGrade: (points: number) => void;
  busy: boolean;
}) {
  const [points, setPoints] = useState('');
  const response = formatResponse(answer.response, options);
  const manualType = MANUAL_TYPES.has(answer.question.type);
  const value = Number(points);
  const valid = points !== '' && Number.isInteger(value) && value >= 0 && value <= maxPoints;

  return (
    <li
      className={`rounded-lg border p-4 ${
        answer.needsManualGrading ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-900">
          <span className="mr-2 text-slate-400">{index}.</span>
          {answer.question.content}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">{maxPoints} pt{maxPoints === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Student&apos;s answer</p>
        <p className={`mt-0.5 whitespace-pre-wrap text-sm ${response ? 'text-slate-800' : 'italic text-slate-400'}`}>
          {response ?? 'No answer given'}
        </p>
      </div>

      {answer.needsManualGrading ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onGrade(value);
          }}
        >
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Award
            <input
              inputMode="numeric"
              value={points}
              onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))}
              aria-label={`Points for question ${index}, out of ${maxPoints}`}
              className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-red-600 focus:outline-none"
            />
            of {maxPoints}
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPoints('0')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPoints(String(maxPoints))}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Full
            </button>
          </div>
          <button
            type="submit"
            disabled={!valid || busy}
            className="ml-auto rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save grade'}
          </button>
          {points !== '' && !valid && <p className="w-full text-xs text-red-700">Enter 0 to {maxPoints}.</p>}
        </form>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-xs">
          {answer.isCorrect ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Correct</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
              {answer.pointsAwarded ? 'Partial' : 'Incorrect'}
            </span>
          )}
          <span className="tabular-nums text-slate-500">
            {answer.pointsAwarded ?? 0} of {maxPoints} · {manualType ? 'graded by hand' : 'auto-graded'}
          </span>
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Review panel
// ---------------------------------------------------------------------------

function AttemptReview({
  attempt,
  exam,
  onGraded,
  nextLabel,
  onNext,
}: {
  attempt: Attempt;
  exam: ExamDetail | undefined;
  onGraded: () => void;
  nextLabel: string | null;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery<AttemptDetail>({
    queryKey: ['attempt-detail', attempt.id],
    queryFn: async () => (await apiClient.get(`/v1/attempts/${attempt.id}`)).data,
  });
  const grade = useMutation({
    mutationFn: ({ questionId, pointsAwarded }: { questionId: string; pointsAwarded: number }) =>
      apiClient.patch(`/v1/attempts/${attempt.id}/answers/${questionId}/grade`, { pointsAwarded }),
    onMutate: () => setError(null),
    onSuccess: onGraded,
    onError: (err) => setError(errorMessage(err,'Could not save that grade.')),
  });

  const byQuestion = new Map(exam?.questions.map((q) => [q.questionId, q]));
  const answers = data?.answers ?? [];
  const pending = answers.filter((a) => a.needsManualGrading).length;
  const manualTotal = answers.filter((a) => MANUAL_TYPES.has(a.question.type)).length;
  const manualDone = manualTotal - pending;
  // Show what still needs a grade first, then the rest in exam order.
  const ordered = [...answers].sort((a, b) => Number(b.needsManualGrading) - Number(a.needsManualGrading));

  const score = data?.score ?? attempt.score;
  const maxScore = data?.maxScore ?? attempt.maxScore;
  const passed = data?.passed ?? attempt.passed;
  const pct = score != null && maxScore ? Math.round((score / maxScore) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <Initials attempt={attempt} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900">{nameOf(attempt)}</p>
            <p className="text-xs text-slate-500">
              {exam?.title ?? 'Exam'}
              {attempt.submittedAt && (
                <> · Submitted {new Date(attempt.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</>
              )}
            </p>
          </div>
          <StatusBadge status={data?.status ?? attempt.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">{pending ? 'Score so far' : 'Final score'}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
              {score != null ? `${score} / ${maxScore}` : '—'}
              {pct !== null && <span className="ml-1.5 text-sm font-medium text-slate-500">{pct}%</span>}
            </p>
            {passed != null && !pending && <PassPill passed={passed} />}
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">Hand-graded answers</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
              {!data ? '—' : manualTotal === 0 ? 'None' : `${manualDone} of ${manualTotal}`}
            </p>
            {data && manualTotal === 0 && <p className="text-[11px] text-slate-500">Every answer was auto-graded</p>}
            {data && manualTotal > 0 && (
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                <span
                  className={`block h-full rounded-full transition-[width] duration-500 ${pending ? 'bg-amber-500' : 'bg-emerald-600'}`}
                  style={{ width: `${(manualDone / manualTotal) * 100}%` }}
                />
              </span>
            )}
          </div>
        </div>

        {data && (
          <p className={`mt-3 text-sm font-medium ${pending ? 'text-amber-800' : 'text-emerald-700'}`}>
            {pending ? `${pending} answer${pending === 1 ? '' : 's'} still need a grade` : 'Fully graded'}
          </p>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {isError && <ErrorState message="Couldn't load this attempt's answers." />}
      {data && answers.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          This attempt has no recorded answers, so there&apos;s nothing to grade.
        </p>
      )}

      <ol className="space-y-3">
        {ordered.map((answer) => {
          const eq = byQuestion.get(answer.questionId);
          return (
            <AnswerCard
              key={answer.id}
              index={answers.indexOf(answer) + 1}
              answer={answer}
              maxPoints={eq?.points ?? 1}
              options={eq?.question.options}
              busy={grade.isPending && grade.variables?.questionId === answer.questionId}
              onGrade={(points) => grade.mutate({ questionId: answer.questionId, pointsAwarded: points })}
            />
          );
        })}
      </ol>

      {nextLabel && data && pending === 0 && (
        <button
          type="button"
          onClick={onNext}
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-red-700 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          <span>
            <span className="block text-xs font-medium text-red-100">Next to grade</span>
            {nextLabel}
          </span>
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden>
            <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Initials({ attempt }: { attempt: Attempt }) {
  const { firstName, lastName } = attempt.student.user;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
      {`${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()}
    </span>
  );
}

function PassPill({ passed }: { passed: boolean }) {
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
      }`}
    >
      {passed ? 'Passed' : 'Below pass mark'}
    </span>
  );
}

function waitingFor(iso: string) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return 'under an hour';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function StatTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'amber' | 'default' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <p className={`text-xs ${tone === 'amber' ? 'text-amber-800' : 'text-slate-500'}`}>{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint && <p className={`text-[11px] ${tone === 'amber' ? 'text-amber-800' : 'text-slate-500'}`}>{hint}</p>}
    </div>
  );
}

const BUCKETS = [
  { label: '0–49', min: 0 },
  { label: '50–59', min: 50 },
  { label: '60–69', min: 60 },
  { label: '70–79', min: 70 },
  { label: '80–89', min: 80 },
  { label: '90–100', min: 90 },
];

// Graded scores as a percentage histogram. A bucket is coloured as passing
// when its lower bound clears the exam's pass mark (itself a points value,
// converted to a percentage of the exam's total points).
function ScoreDistribution({ attempts, passPct }: { attempts: Attempt[]; passPct: number | null }) {
  const data = BUCKETS.map((b, i) => {
    const max = BUCKETS[i + 1]?.min ?? 101;
    const count = attempts.filter((a) => {
      if (a.score == null || !a.maxScore) return false;
      const pct = (a.score / a.maxScore) * 100;
      return pct >= b.min && pct < max;
    }).length;
    return { ...b, count, passing: passPct !== null && b.min >= passPct };
  });

  return (
    <figure>
      <figcaption className="sr-only">
        Score distribution: {data.map((d) => `${d.label}%: ${d.count}`).join(', ')}
      </figcaption>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 18, right: 0, bottom: 0, left: -28 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: '#e2e8f0' }}
            formatter={(value) => [`${value} attempt${value === 1 ? '' : 's'}`, 'Scored']}
            labelFormatter={(label) => `${label}%`}
          />
          <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={42}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.passing ? '#059669' : passPct === null ? '#64748b' : '#dc2626'} />
            ))}
            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#0f172a' }} formatter={(v) => (v ? v : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {passPct !== null && (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-600" />At or above pass mark ({passPct}%)</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-600" />Below</span>
        </p>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

type Filter = 'grading' | 'all';

// Shared by (dashboard)/exams's Grading tab and (instructor)/instructor/grading.
// The API scopes attempts to the caller (ASSIGNED graders only see their own
// classes' attempts), so the same view serves both shells.
export function GradingView() {
  const queryClient = useQueryClient();
  const { data: exams, isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  const [examId, setExamId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  // Every attempt the caller may grade, across all exams, in one request
  // (GET /v1/attempts without examId). Same ['attempts', 'queue'] cache as
  // the instructor Today view, so it's usually already warm.
  const queue = useQuery<Attempt[]>({
    queryKey: ['attempts', 'queue'],
    queryFn: async () => (await apiClient.get('/v1/attempts')).data,
  });
  const perExam = useMemo(() => {
    const counts = new Map<string, number | null>();
    for (const exam of exams ?? []) counts.set(exam.id, queue.data ? 0 : null);
    for (const a of queue.data ?? []) {
      if (a.status === 'SUBMITTED') counts.set(a.examId, (counts.get(a.examId) ?? 0) + 1);
    }
    return counts;
  }, [exams, queue.data]);

  // Exams with work waiting first, then by attempt count, then title.
  const sortedExams = useMemo(
    () =>
      [...(exams ?? [])].sort(
        (a, b) =>
          (perExam.get(b.id) ?? 0) - (perExam.get(a.id) ?? 0) ||
          (b._count?.attempts ?? 0) - (a._count?.attempts ?? 0) ||
          a.title.localeCompare(b.title),
      ),
    [exams, perExam],
  );
  const activeExamId = examId ?? sortedExams.find((e) => (e._count?.attempts ?? 0) > 0)?.id ?? sortedExams[0]?.id ?? '';
  const activeExam = sortedExams.find((e) => e.id === activeExamId);

  const { isLoading, isError } = queue;
  const attempts = useMemo(() => queue.data?.filter((a) => a.examId === activeExamId), [queue.data, activeExamId]);
  // For per-question points and option text in the review panel.
  const { data: examDetail } = useQuery<ExamDetail>({
    queryKey: ['exams', activeExamId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${activeExamId}`)).data,
    enabled: Boolean(activeExamId),
  });

  const list = attempts ?? [];
  const toGrade = list.filter((a) => a.status === 'SUBMITTED');
  const graded = list.filter((a) => a.status === 'GRADED');
  const activeFilter: Filter = filter ?? (toGrade.length > 0 ? 'grading' : 'all');
  const visible = list
    .filter((a) => (activeFilter === 'grading' ? a.status === 'SUBMITTED' : true))
    .sort((a, b) => (a.submittedAt ?? a.startedAt).localeCompare(b.submittedAt ?? b.startedAt));
  const reviewing = list.find((a) => a.id === reviewId) ?? null;
  // Oldest waiting attempt other than the one open — the queue is FIFO.
  const nextUp = toGrade
    .filter((a) => a.id !== reviewId)
    .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))[0];

  // Prefer the exam's own question points; fall back to what attempts were
  // actually scored out of when the exam's questions have since changed.
  const totalPoints =
    examDetail?.questions.reduce((sum, q) => sum + q.points, 0) || list.find((a) => a.maxScore)?.maxScore || 0;
  const passPct = examDetail && totalPoints > 0 ? Math.round((examDetail.passingScore / totalPoints) * 100) : null;
  const questionCount = examDetail?.questions.length ?? 0;
  const avgPct = graded.length
    ? Math.round(graded.reduce((sum, a) => sum + (a.maxScore ? (a.score ?? 0) / a.maxScore : 0), 0) / graded.length * 100)
    : null;
  const passRate = graded.length ? Math.round((graded.filter((a) => a.passed).length / graded.length) * 100) : null;
  const oldestWaiting = [...toGrade].sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))[0];

  const selectExam = (id: string) => {
    setExamId(id);
    setFilter(null);
  };

  if (!examsLoading && sortedExams.length === 0) {
    return <EmptyState title="No exams yet" description="Attempts to grade will appear here once students take an exam." />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <Drawer open={reviewing !== null} onClose={() => setReviewId(null)} title="Review attempt">
        {reviewing && (
          <AttemptReview
            key={reviewing.id}
            attempt={reviewing}
            exam={examDetail}
            nextLabel={nextUp ? nameOf(nextUp) : null}
            onNext={() => nextUp && setReviewId(nextUp.id)}
            onGraded={() => {
              queryClient.invalidateQueries({ queryKey: ['attempt-detail', reviewing.id] });
              // Prefix match: the queue plus the per-exam lists on /results.
              queryClient.invalidateQueries({ queryKey: ['attempts'] });
            }}
          />
        )}
      </Drawer>

      {/* Exam picker: a list on desktop, a select on small screens. */}
      <aside className="min-w-0">
        <label className="block lg:hidden">
          <span className="mb-1 block text-xs font-medium text-slate-500">Exam</span>
          <select
            value={activeExamId}
            onChange={(e) => selectExam(e.target.value)}
            disabled={examsLoading}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-red-600 focus:outline-none"
          >
            {sortedExams.map((exam) => {
              const waiting = perExam.get(exam.id);
              return (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                  {waiting ? ` · ${waiting} to grade` : ''}
                </option>
              );
            })}
          </select>
        </label>

        <Card className="hidden overflow-hidden lg:block">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-semibold tracking-wide text-slate-900">Exams</h2>
            <span className="text-xs tabular-nums text-slate-500">{sortedExams.length}</span>
          </div>
          {examsLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            <ul className="max-h-[32rem] space-y-0.5 overflow-y-auto p-2">
              {sortedExams.map((exam) => {
                const active = exam.id === activeExamId;
                const waiting = perExam.get(exam.id);
                const count = exam._count?.attempts ?? 0;
                return (
                  <li key={exam.id}>
                    <button
                      type="button"
                      onClick={() => selectExam(exam.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-red-700 ${
                        active ? 'bg-red-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-semibold ${active ? 'text-red-800' : 'text-slate-900'}`}>
                          {exam.title}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {count === 0 ? 'No attempts yet' : `${count} attempt${count === 1 ? '' : 's'}`}
                          {exam.program?.name ? ` · ${exam.program.name}` : ''}
                        </span>
                      </span>
                      {waiting ? (
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-700 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                          <span className="sr-only">To grade: </span>
                          {waiting}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </aside>

      <section className="min-w-0 space-y-5">
        {activeExam && (
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-wide text-slate-900">{activeExam.title}</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  {examDetail ? (
                    <>
                      {questionCount > 0 && `${questionCount} question${questionCount === 1 ? '' : 's'} · `}
                      {totalPoints > 0 && `${totalPoints} pts · `}
                      Pass mark {examDetail.passingScore} pts{passPct !== null && ` (${passPct}%)`}
                    </>
                  ) : (
                    <span className="inline-block h-4 w-48 animate-pulse rounded bg-slate-100 align-middle" />
                  )}
                </p>
              </div>
              <StatusBadge status={activeExam.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatTile
                label="To grade"
                value={attempts ? toGrade.length : '—'}
                hint={oldestWaiting?.submittedAt ? `Oldest waiting ${waitingFor(oldestWaiting.submittedAt)}` : 'Queue is clear'}
                tone={toGrade.length > 0 ? 'amber' : 'default'}
              />
              <StatTile label="Graded" value={attempts ? graded.length : '—'} hint={`of ${list.length} attempt${list.length === 1 ? '' : 's'}`} />
              <StatTile label="Average score" value={avgPct === null ? '—' : `${avgPct}%`} hint="Graded attempts" />
              <StatTile label="Pass rate" value={passRate === null ? '—' : `${passRate}%`} hint="Graded attempts" />
            </div>

            {graded.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Score distribution</h3>
                <ScoreDistribution attempts={graded} passPct={passPct} />
              </div>
            )}
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h3 className="text-base font-semibold tracking-wide text-slate-900">Attempts</h3>
            <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter attempts">
              {(
                [
                  ['grading', 'Needs grading', toGrade.length],
                  ['all', 'All attempts', list.length],
                ] as [Filter, string, number][]
              ).map(([id, label, count]) => {
                const active = activeFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                    <span
                      className={`ml-1.5 tabular-nums ${
                        id === 'grading' && count > 0 ? 'font-semibold text-red-700' : 'text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isError && (
            <div className="p-4">
              <ErrorState message="Couldn't load attempts for this exam." />
            </div>
          )}
          {(isLoading || examsLoading) && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}
          {attempts && visible.length === 0 && (
            <div className="flex flex-col items-center px-4 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                  <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
                  <path d="m8.3 12.3 2.5 2.5 4.9-5.3" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-3 text-sm font-medium text-slate-700">
                {activeFilter === 'grading' ? 'All caught up on this exam' : 'No one has attempted this exam yet'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {activeFilter === 'grading' ? 'Every submitted attempt is scored.' : 'Attempts will appear here as students submit.'}
              </p>
            </div>
          )}

          {visible.length > 0 && (
            <ul className="divide-y divide-slate-100 md:hidden">
              {visible.map((a) => {
                const pct = a.score != null && a.maxScore ? Math.round((a.score / a.maxScore) * 100) : null;
                const openable = a.status !== 'IN_PROGRESS';
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled={!openable}
                      onClick={() => setReviewId(a.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition enabled:hover:bg-slate-50 ${a.status === 'SUBMITTED' ? 'bg-amber-50/40' : ''}`}
                    >
                      <Initials attempt={a} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{nameOf(a)}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {a.status === 'SUBMITTED' && a.submittedAt
                            ? <span className="font-medium text-amber-800">Waiting {waitingFor(a.submittedAt)}</span>
                            : a.submittedAt
                              ? new Date(a.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'In progress'}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {a.status === 'SUBMITTED' ? (
                          <span className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white">Grade</span>
                        ) : a.score != null ? (
                          <>
                            <span className="block text-sm font-semibold tabular-nums text-slate-900">{a.score} / {a.maxScore}</span>
                            {pct !== null && (
                              <span className={`block text-[11px] font-medium ${a.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                                {pct}% · {a.passed ? 'Passed' : 'Below'}
                              </span>
                            )}
                          </>
                        ) : (
                          <StatusBadge status={a.status} />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {visible.length > 0 && (
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Student</th>
                    <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Score</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((a) => {
                    const pct = a.score != null && a.maxScore ? Math.round((a.score / a.maxScore) * 100) : null;
                    return (
                      <tr key={a.id} className={`transition-colors hover:bg-slate-50 ${a.status === 'SUBMITTED' ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3">
                            <Initials attempt={a} />
                            <span className="font-medium text-slate-900">{nameOf(a)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {a.submittedAt ? (
                            <>
                              {new Date(a.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              {a.status === 'SUBMITTED' && (
                                <span className="block text-xs font-medium text-amber-800">Waiting {waitingFor(a.submittedAt)}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">In progress</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {a.score != null ? (
                            <>
                              <span className="font-semibold text-slate-900">{a.score}</span> / {a.maxScore}
                              {pct !== null && a.status === 'GRADED' && (
                                <span className={`block text-xs font-medium ${a.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {pct}% · {a.passed ? 'Passed' : 'Below pass mark'}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.status !== 'IN_PROGRESS' && (
                            <button
                              type="button"
                              onClick={() => setReviewId(a.id)}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                                a.status === 'SUBMITTED' ? 'bg-red-700 text-white hover:bg-red-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {a.status === 'SUBMITTED' ? 'Grade' : 'Review'}
                            </button>
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
      </section>
    </div>
  );
}
