'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import { useMyAttempts } from '@/lib/student-hooks';
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
  type Difficulty,
  GroupBars,
  ResultChip,
  ScoreMeter,
  SegmentBar,
  dateTime,
  formatDuration,
  kitGlyphs,
  pctOf,
  qtypeMeta,
} from '@/components/student-exam-kit';

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  id: string;
  type: string;
  content: string;
  options: QuestionOption[] | null;
  difficulty?: Difficulty;
  topic?: string | null;
}

interface ExamFull {
  id: string;
  title: string;
  type: ExamType;
  resultRelease: string;
  passingScore: number;
  timeLimitMinutes: number | null;
  attemptLimit: number;
  questions: { questionId: string; points: number; question: Question }[];
}

interface AttemptAnswer {
  questionId: string;
  response: unknown;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  needsManualGrading: boolean;
}

// A delayed-release attempt that isn't graded yet arrives as
// { id, status, startedAt, submittedAt } only, so everything else is
// optional. An in-progress attempt also carries the server's `deadline`
// (null when untimed) and clock (`serverNow`); `receivedAt` is stamped here.
interface AttemptResult {
  id: string;
  status: string;
  score?: number | null;
  maxScore?: number | null;
  passed?: boolean | null;
  startedAt?: string;
  submittedAt?: string | null;
  gradedAt?: string | null;
  answers?: AttemptAnswer[];
  deadline?: string | null;
  serverNow?: string;
  receivedAt: number;
}

type ExamQuestion = ExamFull['questions'][number];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function draftKey(attemptId: string) {
  return `obias:attempt-draft:${attemptId}`;
}

// The server's deadline moved onto this device's clock. Counting down from
// the device clock alone breaks when it's minutes off: the server refuses
// answers past its own deadline plus a short grace.
function localDeadline(a: AttemptResult) {
  if (!a.deadline || !a.serverNow) return null;
  const skew = new Date(a.serverNow).getTime() - a.receivedAt;
  return new Date(a.deadline).getTime() - skew;
}

function isAnswered(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export default function AttemptPage() {
  const params = useParams<{ examId: string; attemptId: string }>();

  const exam = useQuery<ExamFull>({
    queryKey: ['exam-full', params.examId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${params.examId}`)).data,
  });
  const attempt = useQuery<AttemptResult>({
    queryKey: ['attempt', params.attemptId],
    queryFn: async () => ({ ...(await apiClient.get(`/v1/attempts/${params.attemptId}`)).data, receivedAt: Date.now() }),
  });
  const myAttempts = useMyAttempts();

  // The summary list carries startedAt even when the attempt itself is
  // redacted, and gives the attempt its number within this exam.
  const summary = useMemo(() => {
    const mine = (myAttempts.data ?? [])
      .filter((a) => a.examId === params.examId)
      .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
    const i = mine.findIndex((a) => a.id === params.attemptId);
    return i === -1 ? null : { n: i + 1, used: mine.length, startedAt: mine[i].startedAt };
  }, [myAttempts.data, params.examId, params.attemptId]);

  const examHref = `/student/exams/${params.examId}`;

  if (exam.isLoading || attempt.isLoading) {
    return (
      <StudentShell>
        <SkeletonRows count={1} className="h-40" />
        <div className="mt-5">
          <SkeletonRows count={3} className="h-36" />
        </div>
      </StudentShell>
    );
  }

  if (exam.isError || attempt.isError || !exam.data || !attempt.data) {
    return (
      <StudentShell>
        <BackLink href={examHref}>Exam overview</BackLink>
        <PanelMessage tone="error">Couldn&apos;t load this attempt. Go back to the exam overview and open it again.</PanelMessage>
      </StudentShell>
    );
  }

  return attempt.data.status === 'IN_PROGRESS' ? (
    <TakeView
      exam={exam.data}
      attemptId={params.attemptId}
      examHref={examHref}
      attemptNumber={summary?.n ?? null}
      deadline={localDeadline(attempt.data)}
    />
  ) : (
    <ResultView
      exam={exam.data}
      attempt={attempt.data}
      examHref={examHref}
      attemptNumber={summary?.n ?? null}
      attemptsLeft={summary ? Math.max(0, exam.data.attemptLimit - summary.used) : null}
      startedAt={attempt.data.startedAt ?? summary?.startedAt ?? null}
    />
  );
}

// ===========================================================================
// Taking the exam
// ===========================================================================

function Countdown({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((deadline - now) / 1000));
  const fired = useRef(false);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [left, onExpire]);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const text = `${h > 0 ? `${h}:` : ''}${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  const tone = left === 0 ? 'bg-red-700 text-white' : left <= 300 ? 'bg-amber-100 text-amber-900' : 'bg-white text-slate-800 border border-slate-200';

  return (
    <span
      className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold tabular-nums ${tone}`}
      role="timer"
      aria-label={left === 0 ? 'Time is up' : left < 60 ? `${left} seconds left` : `${Math.ceil(left / 60)} minutes left`}
    >
      {examGlyphs.clock}
      {left === 0 ? "Time's up" : text}
    </span>
  );
}

function TakeView({
  exam,
  attemptId,
  examHref,
  attemptNumber,
  deadline,
}: {
  exam: ExamFull;
  attemptId: string;
  examHref: string;
  attemptNumber: number | null;
  deadline: number | null;
}) {
  const queryClient = useQueryClient();
  // Answers live only in this tab until submit, so keep a draft per attempt:
  // a refresh or a dropped connection shouldn't wipe an hour of work.
  // TakeView mounts only after the attempt query resolves on the client, so
  // reading storage in the initializer can't cause a hydration mismatch.
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    try {
      const saved = localStorage.getItem(draftKey(attemptId));
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(attemptId), JSON.stringify(answers));
    } catch {
      // Storage full or blocked; answers still submit from memory.
    }
  }, [answers, attemptId]);

  const setAnswer = (questionId: string, value: unknown) => {
    setConfirming(false);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submit = useMutation({
    mutationFn: async () => {
      const typeOf = new Map(exam.questions.map((q) => [q.questionId, q.question.type]));
      const payload = {
        answers: Object.entries(answers)
          .filter(([, response]) => isAnswered(response))
          .map(([questionId, response]) => ({
            questionId,
            response: typeOf.get(questionId) === 'NUMERICAL' ? Number(response) : response,
          })),
      };
      return (await apiClient.post(`/v1/attempts/${attemptId}/submit`, payload)).data as AttemptResult;
    },
    onSuccess: () => {
      try {
        localStorage.removeItem(draftKey(attemptId));
      } catch {
        // Nothing to clean up.
      }
      queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] });
      queryClient.invalidateQueries({ queryKey: ['my-attempts'] });
      window.scrollTo({ top: 0 });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['attempt', attemptId] }),
  });
  const submitError =
    isAxiosError(submit.error) && submit.error.response?.status === 400 && typeof submit.error.response.data?.message === 'string'
      ? (submit.error.response.data.message as string)
      : null;

  // Time's up: submit whatever is answered, skipping the unanswered prompt.
  const submitMutate = submit.mutate;
  const onExpire = useCallback(() => submitMutate(), [submitMutate]);

  const total = exam.questions.length;
  const answeredCount = exam.questions.filter((q) => isAnswered(answers[q.questionId])).length;
  const unanswered = total - answeredCount;
  const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);

  const onSubmit = () => {
    if (unanswered > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    submit.mutate();
  };

  return (
    <StudentShell>
      <BackLink href={examHref}>Exam overview</BackLink>

      <div className="mb-4">
        <h1 className="text-2xl font-bold leading-tight tracking-wide text-slate-900 [overflow-wrap:anywhere] sm:text-3xl">{exam.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          {attemptNumber && <span>Attempt {attemptNumber}</span>}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-slate-400">{examGlyphs.list}</span>
            {total} questions · {totalPoints} pts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-slate-400">{examGlyphs.flag}</span>
            Pass at {exam.passingScore} pts
          </span>
        </p>
      </div>

      {/* Progress strip stays pinned under the top bar while answering. */}
      <div className="sticky top-14 z-10 -mx-4 mb-5 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur-sm lg:top-16 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-slate-900">
                <span className="tabular-nums">{answeredCount}</span> of <span className="tabular-nums">{total}</span> answered
              </span>
              <span className="tabular-nums text-slate-500">{pctOf(answeredCount, total)}%</span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label="Questions answered"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={answeredCount}
            >
              <div className="h-full rounded-full bg-red-700 transition-[width] duration-300 ease-out" style={{ width: `${pctOf(answeredCount, total)}%` }} />
            </div>
          </div>
          {deadline && <Countdown deadline={deadline} onExpire={onExpire} />}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <ol className="min-w-0 space-y-4">
          {exam.questions.map((eq, idx) => (
            <QuestionCard key={eq.questionId} eq={eq} index={idx} value={answers[eq.questionId]} onChange={(v) => setAnswer(eq.questionId, v)} />
          ))}
        </ol>

        <aside className="min-w-0 xl:sticky xl:top-[9.5rem]" aria-label="Question navigator and submit">
          <Panel title="Questions" icon={examGlyphs.list}>
            <nav aria-label="Jump to question">
              <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 xl:grid-cols-6">
                {exam.questions.map((eq, idx) => {
                  const done = isAnswered(answers[eq.questionId]);
                  return (
                    <li key={eq.questionId}>
                      <a
                        href={`#q-${idx + 1}`}
                        aria-label={`Question ${idx + 1}, ${done ? 'answered' : 'not answered'}`}
                        className={`flex aspect-square items-center justify-center rounded-md text-xs font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                          done ? 'bg-red-700 text-white hover:bg-red-800' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-3 flex gap-4 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-700" aria-hidden /> Answered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" aria-hidden /> Not yet
              </span>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              {confirming && (
                <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900" role="alert">
                  <strong className="font-semibold">
                    {unanswered} {unanswered === 1 ? 'question is' : 'questions are'} unanswered.
                  </strong>{' '}
                  They&apos;ll score zero, and you can&apos;t change answers after submitting.
                </div>
              )}
              <button
                type="button"
                disabled={submit.isPending}
                onClick={onSubmit}
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-[15px] font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-70"
              >
                {submit.isPending ? 'Submitting…' : confirming ? 'Submit anyway' : 'Submit exam'}
              </button>
              {confirming && (
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center rounded-md text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Keep answering
                </button>
              )}
              {submit.isError && (
                <p className="mt-2 text-xs text-red-700" role="alert">
                  {submitError ?? 'Couldn’t submit. Your answers are saved on this device, so check your connection and try again.'}
                </p>
              )}
              {!confirming && !submit.isError && (
                <p className="mt-2 text-center text-[11px] text-slate-500">Answers are saved on this device until you submit.</p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </StudentShell>
  );
}

function QuestionCard({
  eq,
  index,
  value,
  onChange,
}: {
  eq: ExamQuestion;
  index: number;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { question, points } = eq;
  const meta = qtypeMeta(question.type);
  const done = isAnswered(value);
  const optionClass =
    'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 transition hover:border-slate-300 has-[:checked]:border-red-700 has-[:checked]:bg-red-50/60 has-[:checked]:text-slate-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-red-700';
  const fieldClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-4 focus:ring-red-600/10';

  return (
    <li id={`q-${index + 1}`} className="scroll-mt-40 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5">
      <fieldset>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-bold tabular-nums ${
              done ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {index + 1}
          </span>
          <ResultChip tone="bg-slate-100 text-slate-600" icon={meta.icon}>
            {meta.label}
          </ResultChip>
          <span className="ml-auto font-medium tabular-nums text-slate-500">
            {points} {points === 1 ? 'pt' : 'pts'}
          </span>
        </div>
        <legend className="sr-only">Question {index + 1}</legend>
        <p className="whitespace-pre-line text-[15px] font-medium leading-relaxed text-slate-900">{question.content}</p>

        <div className="mt-4">
          {question.type === 'MULTIPLE_CHOICE' && question.options && (
            <div className="space-y-2">
              {question.options.map((opt, i) => (
                <label key={opt.id} className={optionClass}>
                  <input type="radio" name={question.id} className="peer sr-only" checked={value === opt.id} onChange={() => onChange(opt.id)} />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500 peer-checked:border-red-700 peer-checked:bg-red-700 peer-checked:text-white">
                    {LETTERS[i]}
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">{opt.text}</span>
                </label>
              ))}
            </div>
          )}

          {question.type === 'MULTIPLE_RESPONSE' && question.options && (
            <div className="space-y-2">
              <p className="mb-1 text-xs text-slate-500">Select every answer that applies.</p>
              {question.options.map((opt) => {
                const selected = Array.isArray(value) ? (value as string[]) : [];
                return (
                  <label key={opt.id} className={optionClass}>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={selected.includes(opt.id)}
                      onChange={(e) => onChange(e.target.checked ? [...selected, opt.id] : selected.filter((id) => id !== opt.id))}
                    />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 text-transparent peer-checked:border-red-700 peer-checked:bg-red-700 peer-checked:text-white">
                      {kitGlyphs.check}
                    </span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{opt.text}</span>
                  </label>
                );
              })}
            </div>
          )}

          {question.type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((val) => (
                <label key={String(val)} className={`${optionClass} justify-center font-semibold`}>
                  <input type="radio" name={question.id} className="sr-only" checked={value === val} onChange={() => onChange(val)} />
                  {val ? 'True' : 'False'}
                </label>
              ))}
            </div>
          )}

          {question.type === 'IDENTIFICATION' && (
            <input
              type="text"
              aria-label={`Answer to question ${index + 1}`}
              placeholder="Type your answer"
              className={fieldClass}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
            />
          )}

          {question.type === 'ESSAY' && (
            <textarea
              aria-label={`Answer to question ${index + 1}`}
              placeholder="Write your answer"
              rows={6}
              className={`${fieldClass} leading-relaxed`}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
            />
          )}

          {question.type === 'NUMERICAL' && (
            <input
              type="number"
              inputMode="decimal"
              aria-label={`Answer to question ${index + 1}`}
              placeholder="Enter a number"
              className={`${fieldClass} max-w-xs tabular-nums`}
              value={value === undefined || value === null ? '' : String(value)}
              onChange={(e) => onChange(e.target.value)}
            />
          )}

          {question.type === 'IMAGE_BASED' && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              Image-based questions can&apos;t be answered in the student app yet. Leave it and ask your instructor.
            </p>
          )}
        </div>
      </fieldset>
    </li>
  );
}

// ===========================================================================
// Result and review
// ===========================================================================

type Outcome = 'correct' | 'partial' | 'incorrect' | 'pending' | 'unanswered';

const OUTCOME: Record<Outcome, { label: string; chip: string; tile: string; bar: string; icon: React.ReactNode }> = {
  correct: { label: 'Correct', chip: 'bg-emerald-50 text-emerald-800', tile: 'bg-emerald-600 text-white', bar: 'bg-emerald-600', icon: kitGlyphs.check },
  partial: { label: 'Partial credit', chip: 'bg-blue-50 text-blue-800', tile: 'bg-blue-600 text-white', bar: 'bg-blue-600', icon: kitGlyphs.check },
  incorrect: { label: 'Incorrect', chip: 'bg-red-50 text-red-800', tile: 'bg-red-700 text-white', bar: 'bg-red-700', icon: kitGlyphs.cross },
  pending: { label: 'Awaiting review', chip: 'bg-violet-50 text-violet-800', tile: 'bg-violet-600 text-white', bar: 'bg-violet-500', icon: kitGlyphs.hourglass },
  unanswered: { label: 'Unanswered', chip: 'bg-slate-100 text-slate-600', tile: 'bg-slate-200 text-slate-600', bar: 'bg-slate-300', icon: kitGlyphs.dash },
};

const OUTCOME_ORDER: Outcome[] = ['correct', 'partial', 'incorrect', 'pending', 'unanswered'];

interface ReviewRow {
  n: number;
  eq: ExamQuestion;
  answer: AttemptAnswer | undefined;
  outcome: Outcome;
  earned: number;
}

function outcomeOf(answer: AttemptAnswer | undefined, points: number): Outcome {
  if (!answer) return 'unanswered';
  if (answer.needsManualGrading) return 'pending';
  const earned = answer.pointsAwarded ?? 0;
  if (earned >= points) return 'correct';
  if (earned > 0) return 'partial';
  return 'incorrect';
}

function formatResponse(question: Question, response: unknown): React.ReactNode {
  if (!isAnswered(response)) return <span className="italic text-slate-400">No answer</span>;
  const optionLabel = (id: unknown) => {
    const i = question.options?.findIndex((o) => o.id === id) ?? -1;
    return i >= 0 ? `${LETTERS[i]}. ${question.options![i].text}` : String(id);
  };
  if (question.type === 'MULTIPLE_CHOICE') return optionLabel(response);
  if (question.type === 'MULTIPLE_RESPONSE' && Array.isArray(response)) {
    return (
      <ul className="space-y-0.5">
        {response.map((id) => (
          <li key={String(id)}>{optionLabel(id)}</li>
        ))}
      </ul>
    );
  }
  if (question.type === 'TRUE_FALSE') return response === true || response === 'true' ? 'True' : 'False';
  return <span className="whitespace-pre-line">{String(response)}</span>;
}

type GroupBy = 'topic' | 'difficulty' | 'format';

function ResultView({
  exam,
  attempt,
  examHref,
  attemptNumber,
  attemptsLeft,
  startedAt,
}: {
  exam: ExamFull;
  attempt: AttemptResult;
  examHref: string;
  attemptNumber: number | null;
  attemptsLeft: number | null;
  startedAt: string | null;
}) {
  const [filter, setFilter] = useState<Outcome | 'all'>('all');
  // A jump to a question the filter is hiding clears the filter first, then
  // scrolls once the question is back in the list.
  const jumpTo = useRef<number | null>(null);
  useEffect(() => {
    if (jumpTo.current === null) return;
    document.getElementById(`review-${jumpTo.current}`)?.scrollIntoView({ block: 'start' });
    jumpTo.current = null;
  }, [filter]);
  const type = TYPE_META[exam.type] ?? TYPE_META.PRACTICE;
  const totalPoints = attempt.maxScore ?? exam.questions.reduce((s, q) => s + q.points, 0);
  const passPct = Math.min(100, pctOf(exam.passingScore, totalPoints));
  const graded = attempt.status === 'GRADED' && attempt.score !== undefined && attempt.score !== null;
  const hasReview = Array.isArray(attempt.answers);

  const rows = useMemo<ReviewRow[]>(() => {
    if (!hasReview) return [];
    const byQuestion = new Map(attempt.answers!.map((a) => [a.questionId, a]));
    return exam.questions.map((eq, i) => {
      const answer = byQuestion.get(eq.questionId);
      return { n: i + 1, eq, answer, outcome: outcomeOf(answer, eq.points), earned: answer?.pointsAwarded ?? 0 };
    });
  }, [attempt.answers, exam.questions, hasReview]);

  const counts = Object.fromEntries(OUTCOME_ORDER.map((o) => [o, rows.filter((r) => r.outcome === o).length])) as Record<Outcome, number>;
  const correctCount = counts.correct;
  const pct = graded ? pctOf(attempt.score!, totalPoints) : null;
  const passed = Boolean(attempt.passed);
  const submittedAt = attempt.submittedAt ?? null;

  const verdict = graded
    ? passed
      ? { label: 'Passed', chip: 'bg-emerald-50 text-emerald-800', badge: 'bg-emerald-600 text-white', icon: kitGlyphs.check }
      : { label: 'Below passing', chip: 'bg-amber-50 text-amber-900', badge: 'bg-amber-500 text-white', icon: icons.help }
    : { label: 'Awaiting results', chip: 'bg-violet-50 text-violet-800', badge: 'bg-violet-600 text-white', icon: kitGlyphs.hourglass };

  const dash = <span className="text-slate-300">—</span>;
  // The server closes an attempt with no answers once its time limit (plus a
  // short grace) passes without a submit.
  const timedOut =
    exam.timeLimitMinutes !== null &&
    attempt.answers?.length === 0 &&
    startedAt !== null &&
    submittedAt !== null &&
    new Date(submittedAt).getTime() - new Date(startedAt).getTime() > exam.timeLimitMinutes * 60_000;

  return (
    <StudentShell>
      <BackLink href={examHref}>Exam overview</BackLink>

      <StudentPageHero
        badge={<span className="[&_svg]:h-8 [&_svg]:w-8">{verdict.icon}</span>}
        badgeTone={verdict.badge}
        title={exam.title}
        meta={
          <>
            <ResultChip tone={verdict.chip} icon={verdict.icon}>
              {verdict.label}
            </ResultChip>
            <ResultChip tone={type.tone}>{type.label}</ResultChip>
            {attemptNumber && <span>Attempt {attemptNumber}</span>}
            {submittedAt && <span>· Submitted {dateTime(submittedAt)}</span>}
          </>
        }
      >
        <HeroFigure
          icon={examGlyphs.flag}
          tone="bg-red-50 text-red-700"
          value={
            graded ? (
              <>
                {attempt.score}
                <span className="text-base font-semibold text-slate-400">/{totalPoints}</span>
              </>
            ) : (
              dash
            )
          }
          label={`Points · pass at ${exam.passingScore}`}
        />
        <HeroFigure icon={icons.progress} tone="bg-amber-50 text-amber-700" value={pct !== null ? `${pct}%` : dash} label="Score" />
        <HeroFigure
          icon={kitGlyphs.check}
          tone="bg-emerald-50 text-emerald-700"
          value={
            hasReview ? (
              <>
                {correctCount}
                <span className="text-base font-semibold text-slate-400">/{rows.length}</span>
              </>
            ) : (
              dash
            )
          }
          label={counts.partial > 0 ? `Questions correct · ${counts.partial} partial` : 'Questions correct'}
        />
        <HeroFigure
          icon={examGlyphs.clock}
          tone="bg-blue-50 text-blue-700"
          value={startedAt && submittedAt ? formatDuration(startedAt, submittedAt) : dash}
          label={exam.timeLimitMinutes ? `Time taken · limit ${exam.timeLimitMinutes} min` : 'Time taken'}
        />
      </StudentPageHero>

      {timedOut && (
        <p className="mb-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900" role="status">
          <span className="mt-0.5 shrink-0 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
            {examGlyphs.clock}
          </span>
          Time ran out before this attempt was submitted, so it was closed with no answers recorded.
        </p>
      )}

      {!hasReview && (
        <Panel title="Grading in Progress" icon={kitGlyphs.hourglass}>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm leading-relaxed text-slate-600">
              Your answers were submitted{submittedAt ? ` on ${dateTime(submittedAt)}` : ''}. This exam releases results after an instructor
              finishes grading, so your score and a question-by-question review will appear on this page then.
            </p>
            <Link
              href={examHref}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Exam overview
              {icons.arrowRight}
            </Link>
          </div>
        </Panel>
      )}

      {hasReview && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Your Result" icon={icons.progress}>
              {graded && pct !== null ? (
                <>
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <p className={`text-5xl font-bold leading-none tabular-nums ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>{pct}%</p>
                    <p className="max-w-[16rem] text-right text-sm leading-snug text-slate-600">
                      {passed
                        ? attempt.score! === exam.passingScore
                          ? 'You met the passing mark exactly.'
                          : `You cleared the passing mark by ${attempt.score! - exam.passingScore} ${attempt.score! - exam.passingScore === 1 ? 'point' : 'points'}.`
                        : `You needed ${exam.passingScore - attempt.score!} more ${exam.passingScore - attempt.score! === 1 ? 'point' : 'points'} to pass.`}
                    </p>
                  </div>
                  <ScoreMeter pct={pct} passPct={passPct} passed={passed} />
                </>
              ) : (
                <p className="mb-2 rounded-lg bg-violet-50/70 px-3 py-2.5 text-sm text-violet-900">
                  {counts.pending} {counts.pending === 1 ? 'answer is' : 'answers are'} waiting for an instructor to grade. Your final score
                  appears once they&apos;re done.
                </p>
              )}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">How your answers went</h3>
                <SegmentBar
                  segments={OUTCOME_ORDER.filter((o) => counts[o] > 0 || o === 'correct' || o === 'incorrect').map((o) => ({
                    key: o,
                    label: OUTCOME[o].label,
                    value: counts[o],
                    bar: OUTCOME[o].bar,
                  }))}
                  unit={['question', 'questions']}
                  caption="Questions by outcome"
                />
              </div>
            </Panel>

            <BreakdownPanel rows={rows} passPct={passPct} />
          </div>

          <Panel
            title="Question Review"
            icon={icons.quiz}
            action={
              <span className="text-xs text-slate-500">
                {rows.length} questions · {totalPoints} pts
              </span>
            }
          >
            <nav aria-label="Jump to question" className="mb-5">
              <ul className="flex flex-wrap gap-1.5">
                {rows.map((r) => (
                  <li key={r.n}>
                    <a
                      href={`#review-${r.n}`}
                      onClick={(e) => {
                        if (filter === 'all' || r.outcome === filter) return;
                        e.preventDefault();
                        jumpTo.current = r.n;
                        setFilter('all');
                      }}
                      aria-label={`Question ${r.n}: ${OUTCOME[r.outcome].label}`}
                      className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${OUTCOME[r.outcome].tile}`}
                    >
                      {r.n}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter questions">
              {(['all', ...OUTCOME_ORDER] as const)
                .filter((o) => o === 'all' || counts[o] > 0)
                .map((o) => {
                  const selected = filter === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setFilter(o)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${
                        selected ? 'border-red-700 bg-red-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {o === 'all' ? 'All' : OUTCOME[o].label}
                      <span className={`tabular-nums ${selected ? 'text-red-100' : 'text-slate-400'}`}>{o === 'all' ? rows.length : counts[o]}</span>
                    </button>
                  );
                })}
            </div>

            <ol className="space-y-3">
              {rows
                .filter((r) => filter === 'all' || r.outcome === filter)
                .map((r) => {
                  const o = OUTCOME[r.outcome];
                  const meta = qtypeMeta(r.eq.question.type);
                  return (
                    <li key={r.n} id={`review-${r.n}`} className="scroll-mt-24 rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${o.tile}`} aria-hidden>
                          {o.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className="font-bold text-slate-900">Question {r.n}</span>
                            <ResultChip tone={o.chip}>{o.label}</ResultChip>
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <span className="text-slate-400">{meta.icon}</span>
                              {meta.label}
                            </span>
                            <span className="ml-auto font-semibold tabular-nums text-slate-700">
                              {r.outcome === 'pending' ? '—' : r.earned}/{r.eq.points} pts
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-900">{r.eq.question.content}</p>
                          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                            <span className="mb-0.5 block text-[11px] font-semibold text-slate-500">Your answer</span>
                            {formatResponse(r.eq.question, r.answer?.response)}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ol>
          </Panel>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/student/exams"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              All exams
            </Link>
            <Link
              href={examHref}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              {attemptsLeft && graded && !passed ? 'Retake from the exam overview' : 'Exam overview'}
              {icons.arrowRight}
            </Link>
          </div>
        </div>
      )}
    </StudentShell>
  );
}

// Points earned vs. possible per topic, difficulty, or format, with the
// passing mark as the bar every group is measured against.
function BreakdownPanel({ rows, passPct }: { rows: ReviewRow[]; passPct: number }) {
  const build = (by: GroupBy) => {
    const map = new Map<string, { label: string; icon?: React.ReactNode; earned: number; possible: number; order: number }>();
    for (const r of rows) {
      if (r.outcome === 'pending') continue;
      const q = r.eq.question;
      let key: string | null | undefined;
      let label = '';
      let icon: React.ReactNode | undefined;
      let order = 0;
      if (by === 'topic') {
        key = q.topic?.trim();
        label = key ?? '';
      } else if (by === 'difficulty') {
        key = q.difficulty;
        label = key ? DIFFICULTY_META[key as Difficulty]?.label ?? key : '';
        order = ['EASY', 'MODERATE', 'DIFFICULT'].indexOf(key ?? '');
      } else {
        key = q.type;
        const meta = qtypeMeta(q.type);
        label = meta.label;
        icon = meta.icon;
      }
      if (!key) continue;
      const cur = map.get(key) ?? { label, icon, earned: 0, possible: 0, order };
      map.set(key, { ...cur, earned: cur.earned + r.earned, possible: cur.possible + r.eq.points });
    }
    return [...map.entries()]
      .sort((a, b) => (by === 'difficulty' ? a[1].order - b[1].order : b[1].possible - a[1].possible))
      .map(([key, g]) => {
        const value = pctOf(g.earned, g.possible);
        return {
          key,
          label: g.label,
          icon: g.icon,
          value,
          detail: `${g.earned}/${g.possible} pts`,
          tone: value >= passPct ? 'bg-emerald-600' : 'bg-amber-500',
        };
      });
  };

  const options = (['topic', 'difficulty', 'format'] as GroupBy[])
    .map((by) => ({ by, groups: build(by) }))
    .filter((o) => o.groups.length > 0);
  const [by, setBy] = useState<GroupBy>(options.find((o) => o.groups.length > 1)?.by ?? options[0]?.by ?? 'format');
  const active = options.find((o) => o.by === by) ?? options[0];
  const weakest = active?.groups.filter((g) => g.value < passPct).sort((a, b) => a.value - b.value)[0];
  const LABEL: Record<GroupBy, string> = { topic: 'Topic', difficulty: 'Difficulty', format: 'Format' };

  return (
    <Panel
      title="Where You Scored"
      icon={icons.layers}
      action={
        options.length > 1 ? (
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Group scores by">
            {options.map((o) => (
              <button
                key={o.by}
                type="button"
                aria-pressed={o.by === active?.by}
                onClick={() => setBy(o.by)}
                className={`min-h-[30px] rounded-md px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-red-700 ${
                  o.by === active?.by ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.1)]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {LABEL[o.by]}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {!active ? (
        <PanelMessage>A breakdown appears once your answers are graded.</PanelMessage>
      ) : (
        <>
          <GroupBars rows={active.groups} marker={passPct} caption={`Points earned by ${LABEL[active.by].toLowerCase()}, against the ${passPct}% passing mark`} />
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-emerald-600" aria-hidden /> At or above pass
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-amber-500" aria-hidden /> Below pass
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-0.5 rounded-full bg-slate-900/70" aria-hidden /> Passing mark {passPct}%
            </span>
          </div>
          {weakest && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
              <strong className="font-semibold">Review next:</strong> {weakest.label}, where you earned {weakest.detail}.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
