'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiClient } from '@/lib/api-client';
import { type AttemptSummary, useMyAttempts } from '@/lib/student-hooks';
import {
  HeroFigure,
  Panel,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
} from '@/components/student-ui';
import { type ExamType, TYPE_META, examGlyphs } from '@/components/student-exam-list';
import {
  BackLink,
  DIFFICULTY_META,
  DIFFICULTY_ORDER,
  type Difficulty,
  GroupBars,
  ResultChip,
  ScoreMeter,
  SegmentBar,
  formatDuration,
  kitGlyphs,
  pctOf,
  qtypeMeta,
  shortDate,
} from '@/components/student-exam-kit';

interface ExamDetail {
  id: string;
  title: string;
  type: ExamType;
  passingScore: number;
  attemptLimit: number;
  timeLimitMinutes: number | null;
  resultRelease: string;
  questions: {
    questionId: string;
    points: number;
    question?: { type: string; difficulty?: Difficulty; topic?: string | null };
  }[];
}

// Attempts are numbered in the order they were started, so "Attempt 2"
// means the same thing here, on the attempt page, and in the chart.
interface NumberedAttempt extends AttemptSummary {
  n: number;
  pct: number | null;
}

type Standing = 'todo' | 'in-progress' | 'awaiting' | 'passed' | 'below' | 'locked';

const STANDING: Record<Standing, { label: string; chip: string; icon: React.ReactNode }> = {
  todo: { label: 'Not started', chip: 'bg-slate-100 text-slate-700', icon: examGlyphs.flag },
  'in-progress': { label: 'In progress', chip: 'bg-blue-50 text-blue-800', icon: examGlyphs.clock },
  awaiting: { label: 'Awaiting results', chip: 'bg-violet-50 text-violet-800', icon: kitGlyphs.hourglass },
  passed: { label: 'Passed', chip: 'bg-emerald-50 text-emerald-800', icon: kitGlyphs.check },
  below: { label: 'Below passing', chip: 'bg-amber-50 text-amber-900', icon: icons.help },
  locked: { label: 'No attempts left', chip: 'bg-slate-100 text-slate-600', icon: kitGlyphs.lock },
};

function attemptStatus(a: NumberedAttempt) {
  if (a.status === 'IN_PROGRESS') return { label: 'In progress', tone: 'bg-blue-50 text-blue-800', icon: examGlyphs.clock };
  if (a.status === 'SUBMITTED' || a.pct === null) return { label: 'Awaiting results', tone: 'bg-violet-50 text-violet-800', icon: kitGlyphs.hourglass };
  return a.passed
    ? { label: 'Passed', tone: 'bg-emerald-50 text-emerald-800', icon: kitGlyphs.check }
    : { label: 'Below passing', tone: 'bg-amber-50 text-amber-900', icon: kitGlyphs.cross };
}

export default function ExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const exam = useQuery<ExamDetail>({
    queryKey: ['exam', params.examId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${params.examId}`)).data,
  });
  const myAttempts = useMyAttempts();

  const startAttempt = useMutation({
    mutationFn: async () => (await apiClient.post('/v1/attempts', { examId: params.examId })).data as { id: string },
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({ queryKey: ['my-attempts'] });
      router.push(`/student/exams/${params.examId}/attempt/${attempt.id}`);
    },
  });

  const totalPoints = exam.data?.questions.reduce((s, q) => s + q.points, 0) ?? 0;

  const attempts = useMemo<NumberedAttempt[]>(
    () =>
      (myAttempts.data ?? [])
        .filter((a) => a.examId === params.examId)
        .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
        .map((a, i) => ({
          ...a,
          n: i + 1,
          pct: a.status === 'GRADED' && a.score !== undefined && a.maxScore ? pctOf(a.score, a.maxScore) : null,
        })),
    [myAttempts.data, params.examId],
  );

  if (exam.isLoading) {
    return (
      <StudentShell>
        <SkeletonRows count={1} className="h-44" />
        <div className="mt-5">
          <SkeletonRows count={2} className="h-56" />
        </div>
      </StudentShell>
    );
  }

  if (exam.isError || !exam.data) {
    return (
      <StudentShell>
        <BackLink href="/student/exams">All exams</BackLink>
        <PanelMessage tone="error">Couldn&apos;t load this exam. It may have been unpublished. Go back to your exams and try again.</PanelMessage>
      </StudentShell>
    );
  }

  const e = exam.data;
  const type = TYPE_META[e.type] ?? TYPE_META.PRACTICE;
  const passPct = Math.min(100, pctOf(e.passingScore, totalPoints));
  const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS');
  const graded = attempts.filter((a) => a.pct !== null);
  const best = graded.reduce<NumberedAttempt | null>((b, a) => (!b || a.pct! > b.pct! ? a : b), null);
  const used = attempts.length;
  const left = Math.max(0, e.attemptLimit - used);

  let standing: Standing = 'todo';
  if (inProgress) standing = 'in-progress';
  else if (graded.some((a) => a.passed)) standing = 'passed';
  else if (attempts.some((a) => a.status === 'SUBMITTED' || (a.status === 'GRADED' && a.pct === null))) standing = 'awaiting';
  else if (graded.length > 0) standing = left > 0 ? 'below' : 'locked';
  else if (left === 0) standing = 'locked';

  return (
    <StudentShell>
      <BackLink href="/student/exams">All exams</BackLink>

      <StudentPageHero
        badge={type.icon}
        title={e.title}
        meta={
          <>
            <ResultChip tone={type.tone}>{type.label}</ResultChip>
            <ResultChip tone={STANDING[standing].chip} icon={STANDING[standing].icon}>
              {STANDING[standing].label}
            </ResultChip>
            <span className="text-slate-500">{type.hint}</span>
          </>
        }
      >
        <HeroFigure
          icon={examGlyphs.clock}
          tone="bg-blue-50 text-blue-700"
          value={e.timeLimitMinutes ? `${e.timeLimitMinutes} min` : 'Untimed'}
          label="Time limit"
        />
        <HeroFigure icon={examGlyphs.list} tone="bg-red-50 text-red-700" value={e.questions.length} label={`Questions · ${totalPoints} pts`} />
        <HeroFigure icon={examGlyphs.flag} tone="bg-amber-50 text-amber-700" value={`${e.passingScore} pts`} label={`To pass · ${passPct}%`} />
        <HeroFigure
          icon={icons.quiz}
          tone="bg-emerald-50 text-emerald-700"
          value={
            <>
              {used}
              <span className="text-base font-semibold text-slate-400">/{e.attemptLimit}</span>
            </>
          }
          label="Attempts used"
        />
      </StudentPageHero>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <aside className="min-w-0 xl:sticky xl:top-20 xl:order-last" aria-label="Take this exam">
          <ActionPanel
            examId={e.id}
            standing={standing}
            left={left}
            limit={e.attemptLimit}
            best={best}
            passPct={passPct}
            resultRelease={e.resultRelease}
            inProgressId={inProgress?.id ?? null}
            starting={startAttempt.isPending}
            startError={startAttempt.isError}
            onStart={() => startAttempt.mutate()}
            history={myAttempts.isSuccess ? 'ready' : myAttempts.isError ? 'error' : 'loading'}
            onRetryHistory={() => myAttempts.refetch()}
          />
        </aside>

        <div className="min-w-0 space-y-5">
          <AttemptsPanel
            examId={e.id}
            attempts={attempts}
            passPct={passPct}
            loading={myAttempts.isLoading}
            error={myAttempts.isError}
          />
          <CompositionPanel questions={e.questions} totalPoints={totalPoints} />
        </div>
      </div>
    </StudentShell>
  );
}

// ---------------------------------------------------------------------------
// Take / resume / retake
// ---------------------------------------------------------------------------

function ActionPanel({
  examId,
  standing,
  left,
  limit,
  best,
  passPct,
  resultRelease,
  inProgressId,
  starting,
  startError,
  onStart,
  history,
  onRetryHistory,
}: {
  examId: string;
  standing: Standing;
  left: number;
  limit: number;
  best: NumberedAttempt | null;
  passPct: number;
  resultRelease: string;
  inProgressId: string | null;
  starting: boolean;
  startError: boolean;
  onStart: () => void;
  history: 'loading' | 'error' | 'ready';
  onRetryHistory: () => void;
}) {
  const heading =
    standing === 'in-progress'
      ? 'Pick up where you left off'
      : standing === 'passed'
        ? 'You passed this exam'
        : standing === 'below'
          ? 'Ready for another try?'
          : standing === 'awaiting'
            ? 'Your answers are in'
            : standing === 'locked'
              ? 'No attempts left'
              : 'Ready when you are';

  const buttonBase =
    'inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md px-4 text-[15px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700';

  return (
    <Panel title={heading} icon={kitGlyphs.bolt}>
      {best && best.pct !== null && (
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <span className="text-slate-500">Best score · attempt {best.n}</span>
            <span className={`text-2xl font-bold tabular-nums ${best.passed ? 'text-emerald-700' : 'text-amber-700'}`}>{best.pct}%</span>
          </div>
          <ScoreMeter pct={best.pct} passPct={passPct} passed={Boolean(best.passed)} />
        </div>
      )}

      <ul className="space-y-3 text-sm text-slate-600">
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-slate-400">{resultRelease === 'IMMEDIATE' ? kitGlyphs.bolt : kitGlyphs.hourglass}</span>
          <span>
            {resultRelease === 'IMMEDIATE'
              ? 'Results appear as soon as you submit.'
              : 'Results appear after an instructor finishes grading.'}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-slate-400">{kitGlyphs.lock}</span>
          <span>Answers are final once submitted. Unanswered questions score zero.</span>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-slate-400">{icons.quiz}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {limit <= 8 && (
              <span className="inline-flex gap-1" aria-hidden>
                {Array.from({ length: limit }, (_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${i < limit - left ? 'bg-red-700' : 'bg-slate-200'}`} />
                ))}
              </span>
            )}
            <span className="tabular-nums">
              {left} of {limit} {limit === 1 ? 'attempt' : 'attempts'} left
            </span>
          </span>
        </li>
      </ul>

      <div className="mt-5 border-t border-slate-100 pt-5">
        {/* Until the attempt history loads, "no attempt in progress" and
            "attempts left" are unknown — starting now could open a second
            attempt next to one already running and use up another try. */}
        {history === 'loading' ? (
          <button type="button" disabled className={`${buttonBase} bg-red-700 text-white disabled:cursor-wait disabled:opacity-70`}>
            Checking your attempts…
          </button>
        ) : history === 'error' ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            Couldn&apos;t load your attempts on this exam, so starting is paused.{' '}
            <button type="button" onClick={onRetryHistory} className="font-semibold underline underline-offset-2">
              Try again
            </button>
          </div>
        ) : inProgressId ? (
          <Link href={`/student/exams/${examId}/attempt/${inProgressId}`} className={`${buttonBase} bg-red-700 text-white hover:bg-red-800`}>
            Resume attempt
            {icons.arrowRight}
          </Link>
        ) : left > 0 ? (
          <button
            type="button"
            disabled={starting}
            onClick={onStart}
            className={`${buttonBase} ${
              standing === 'passed'
                ? 'border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                : 'bg-red-700 text-white hover:bg-red-800'
            } disabled:cursor-wait disabled:opacity-70`}
          >
            {starting ? 'Starting…' : standing === 'todo' ? 'Start attempt' : 'Start a new attempt'}
            {!starting && icons.arrowRight}
          </button>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-md bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
            {kitGlyphs.lock}
            You&apos;ve used every attempt on this exam.
          </p>
        )}
        {startError && (
          <p className="mt-2 text-xs text-red-700" role="alert">
            Couldn&apos;t start a new attempt. You may have reached the limit; refresh to check.
          </p>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Attempt history: score per attempt against the passing mark, then the list
// ---------------------------------------------------------------------------

function AttemptTooltip({ active, payload, passPct }: { active?: boolean; payload?: { payload: NumberedAttempt }[]; passPct: number }) {
  if (!active || !payload?.length) return null;
  const a = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-[0_10px_24px_-12px_rgb(15_23_42/0.3)]">
      <p className="font-semibold text-slate-900">Attempt {a.n}</p>
      <p className="mt-0.5 text-slate-500">{shortDate(a.submittedAt ?? a.startedAt)}</p>
      <p className="mt-1.5 tabular-nums text-slate-700">
        <span className="font-semibold text-slate-900">
          {a.score}/{a.maxScore} pts · {a.pct}%
        </span>{' '}
        · pass {passPct}%
      </p>
    </div>
  );
}

function AttemptsPanel({
  examId,
  attempts,
  passPct,
  loading,
  error,
}: {
  examId: string;
  attempts: NumberedAttempt[];
  passPct: number;
  loading: boolean;
  error: boolean;
}) {
  const graded = attempts.filter((a) => a.pct !== null);
  const first = graded.at(0);
  const last = graded.at(-1);
  const change = graded.length > 1 && first && last ? last.pct! - first.pct! : null;

  return (
    <Panel
      title="Your Attempts"
      icon={icons.progress}
      action={
        change !== null ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
          >
            {change >= 0 ? '+' : '−'}
            {Math.abs(change)} pts since attempt {first!.n}
          </span>
        ) : undefined
      }
    >
      {loading && <SkeletonRows count={2} className="h-14" />}
      {!loading && error && <PanelMessage tone="error">Couldn&apos;t load your attempts. Refresh the page to try again.</PanelMessage>}
      {!loading && !error && attempts.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icons.progress}</span>
          <span className="font-semibold text-slate-700">No attempts yet</span>
          <span>Each attempt you take is scored and charted here against the passing mark.</span>
        </PanelMessage>
      )}

      {!loading && !error && graded.length > 0 && (
        <figure className="mb-4">
          <figcaption className="sr-only">
            Score per attempt against the {passPct}% passing mark: {graded.map((a) => `attempt ${a.n} ${a.pct}%`).join(', ')}
          </figcaption>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={graded} margin={{ top: 12, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis
                dataKey="n"
                tickFormatter={(n: number) => `#${n}`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<AttemptTooltip passPct={passPct} />} cursor={{ fill: '#f8fafc' }} />
              <ReferenceLine
                y={passPct}
                stroke="#0f172a"
                strokeDasharray="5 4"
                strokeWidth={1.25}
              />
              <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {graded.map((a) => (
                  <Cell key={a.id} fill={a.passed ? '#059669' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500" aria-hidden>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-emerald-600" /> Passed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-amber-500" /> Below passing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-[1.5px] border-dashed border-slate-900" /> Passing mark {passPct}%
            </span>
          </div>
        </figure>
      )}

      {!loading && !error && attempts.length > 0 && (
        <ol className="-mx-2 divide-y divide-slate-100">
          {[...attempts].reverse().map((a) => {
            const s = attemptStatus(a);
            return (
              <li key={a.id}>
                <Link
                  href={`/student/exams/${examId}/attempt/${a.id}`}
                  className="group flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                >
                  <span
                    className={`flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg text-sm font-bold leading-none tabular-nums ${
                      a.pct === null ? 'bg-slate-100 text-slate-500' : a.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    {a.pct === null ? <span className="[&_svg]:h-4 [&_svg]:w-4">{s.icon}</span> : `${a.pct}%`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-slate-900">Attempt {a.n}</span>
                      <ResultChip tone={s.tone}>{s.label}</ResultChip>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {a.status === 'IN_PROGRESS'
                        ? `Started ${shortDate(a.startedAt)}`
                        : `${shortDate(a.submittedAt ?? a.startedAt)}${a.submittedAt ? ` · ${formatDuration(a.startedAt, a.submittedAt)}` : ''}`}
                      {a.pct !== null && ` · ${a.score}/${a.maxScore} pts`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-400 transition group-hover:text-red-700">
                    <span className="hidden sm:inline">{a.status === 'IN_PROGRESS' ? 'Resume' : 'Review'}</span>
                    <span className="inline-block align-middle sm:ml-1">{icons.arrowRight}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// What's on the exam: difficulty mix, formats, and topics by point weight
// ---------------------------------------------------------------------------

function CompositionPanel({ questions, totalPoints }: { questions: ExamDetail['questions']; totalPoints: number }) {
  const difficulty = DIFFICULTY_ORDER.map((d) => ({
    key: d,
    label: DIFFICULTY_META[d].label,
    value: questions.filter((q) => q.question?.difficulty === d).length,
    bar: DIFFICULTY_META[d].bar,
  }));
  const hasDifficulty = difficulty.some((d) => d.value > 0);

  const group = (keyOf: (q: ExamDetail['questions'][number]) => string | null | undefined) => {
    const map = new Map<string, { count: number; points: number }>();
    for (const q of questions) {
      const k = keyOf(q);
      if (!k) continue;
      const cur = map.get(k) ?? { count: 0, points: 0 };
      map.set(k, { count: cur.count + 1, points: cur.points + q.points });
    }
    return [...map.entries()].sort((a, b) => b[1].points - a[1].points);
  };

  const formats = group((q) => q.question?.type).map(([k, v]) => {
    const meta = qtypeMeta(k);
    return {
      key: k,
      label: meta.label,
      icon: meta.icon,
      value: pctOf(v.points, totalPoints),
      detail: `${v.count} ${v.count === 1 ? 'question' : 'questions'}`,
      tone: 'bg-slate-700',
    };
  });

  const topics = group((q) => q.question?.topic?.trim()).slice(0, 6).map(([k, v]) => ({
    key: k,
    label: k,
    value: pctOf(v.points, totalPoints),
    detail: `${v.points} pts`,
    tone: 'bg-red-700',
  }));

  if (questions.length === 0) return null;

  return (
    <Panel title="What's on This Exam" icon={icons.layers}>
      <div className="grid gap-x-8 gap-y-7 lg:grid-cols-2">
        {hasDifficulty && (
          <section className="lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Difficulty mix</h3>
            <SegmentBar segments={difficulty} unit={['question', 'questions']} caption="Questions by difficulty" />
          </section>
        )}
        {formats.length > 0 && (
          <section className={topics.length === 0 ? 'lg:col-span-2' : ''}>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">Question formats</h3>
            <p className="mb-3 text-xs text-slate-500">Share of the {totalPoints} total points</p>
            <GroupBars rows={formats} caption="Share of points by question format" />
          </section>
        )}
        {topics.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">Heaviest topics</h3>
            <p className="mb-3 text-xs text-slate-500">Where the points are concentrated</p>
            <GroupBars rows={topics} caption="Share of points by topic" />
          </section>
        )}
      </div>
    </Panel>
  );
}
