'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
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

function errorText(err: unknown, fallback: string) {
  const m = isAxiosError<{ message?: string | string[] }>(err) ? err.response?.data?.message : undefined;
  return (Array.isArray(m) ? m.join('. ') : m) ?? fallback;
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

function AttemptReview({ attempt, exam, onGraded }: { attempt: Attempt; exam: ExamDetail | undefined; onGraded: () => void }) {
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
    onError: (err) => setError(errorText(err, 'Could not save that grade.')),
  });

  const byQuestion = new Map(exam?.questions.map((q) => [q.questionId, q]));
  const answers = data?.answers ?? [];
  const pending = answers.filter((a) => a.needsManualGrading).length;
  // Show what still needs a grade first, then the rest in exam order.
  const ordered = [...answers].sort((a, b) => Number(b.needsManualGrading) - Number(a.needsManualGrading));

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-900">{nameOf(attempt)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <StatusBadge status={data?.status ?? attempt.status} />
          {(data?.score ?? attempt.score) != null && (
            <span className="tabular-nums">
              Score {data?.score ?? attempt.score} / {data?.maxScore ?? attempt.maxScore}
            </span>
          )}
          {attempt.submittedAt && <span>Submitted {new Date(attempt.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
        </div>
        {data && (
          <p className={`mt-2 text-sm font-medium ${pending ? 'text-amber-800' : 'text-emerald-700'}`}>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

type Filter = 'grading' | 'all';

// Shared by (dashboard)/exams's Grading tab and (instructor)/instructor/grading —
// the exam engine has no instructor-scoping concept yet (attempts are keyed
// only by examId), so both surfaces show the same exam picker; only the shell
// around it differs.
export function GradingView() {
  const queryClient = useQueryClient();
  const { data: exams, isLoading: examsLoading } = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  const [examId, setExamId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  // Exams with attempts first, most attempts on top.
  const sortedExams = useMemo(
    () => [...(exams ?? [])].sort((a, b) => (b._count?.attempts ?? 0) - (a._count?.attempts ?? 0) || a.title.localeCompare(b.title)),
    [exams],
  );
  const activeExamId = examId ?? sortedExams.find((e) => (e._count?.attempts ?? 0) > 0)?.id ?? sortedExams[0]?.id ?? '';

  const { data: attempts, isLoading, isError } = useQuery<Attempt[]>({
    queryKey: ['attempts', activeExamId],
    queryFn: async () => (await apiClient.get('/v1/attempts', { params: { examId: activeExamId } })).data,
    enabled: Boolean(activeExamId),
  });
  // For per-question points and option text in the review panel.
  const { data: examDetail } = useQuery<ExamDetail>({
    queryKey: ['exams', activeExamId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${activeExamId}`)).data,
    enabled: Boolean(activeExamId),
  });

  const list = attempts ?? [];
  const toGrade = list.filter((a) => a.status === 'SUBMITTED').length;
  const activeFilter: Filter = filter ?? (toGrade > 0 ? 'grading' : 'all');
  const visible = list
    .filter((a) => (activeFilter === 'grading' ? a.status === 'SUBMITTED' : true))
    .sort((a, b) => (a.submittedAt ?? a.startedAt).localeCompare(b.submittedAt ?? b.startedAt));
  const reviewing = list.find((a) => a.id === reviewId) ?? null;

  return (
    <div className="space-y-4">
      <Drawer open={reviewing !== null} onClose={() => setReviewId(null)} title="Review attempt">
        {reviewing && (
          <AttemptReview
            key={reviewing.id}
            attempt={reviewing}
            exam={examDetail}
            onGraded={() => {
              queryClient.invalidateQueries({ queryKey: ['attempt-detail', reviewing.id] });
              queryClient.invalidateQueries({ queryKey: ['attempts', activeExamId] });
            }}
          />
        )}
      </Drawer>

      {!examsLoading && sortedExams.length === 0 ? (
        <EmptyState title="No exams yet" description="Attempts to grade will appear here once students take an exam." />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="block sm:w-80">
              <span className="sr-only">Exam</span>
              <select
                value={activeExamId}
                onChange={(e) => {
                  setExamId(e.target.value);
                  setFilter(null);
                }}
                disabled={examsLoading}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-red-600 focus:outline-none"
              >
                {sortedExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                    {exam._count ? ` (${exam._count.attempts} attempt${exam._count.attempts === 1 ? '' : 's'})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter attempts">
              {(
                [
                  ['grading', 'Needs grading', toGrade],
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
                      active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                    <span
                      className={`ml-1.5 tabular-nums ${
                        active ? 'text-red-100' : id === 'grading' && count > 0 ? 'font-semibold text-red-700' : 'text-slate-400'
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
            <p className="px-4 py-14 text-center text-sm text-slate-500">
              {activeFilter === 'grading' ? 'Nothing to grade for this exam. Every submitted attempt is scored.' : 'No one has attempted this exam yet.'}
            </p>
          )}

          {visible.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
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
                  {visible.map((a) => (
                    <tr key={a.id} className={`transition-colors hover:bg-slate-50 ${a.status === 'SUBMITTED' ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">{nameOf(a)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {a.submittedAt
                          ? new Date(a.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                          : <span className="text-slate-400">In progress</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {a.score != null ? `${a.score} / ${a.maxScore}` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status !== 'IN_PROGRESS' && (
                          <button
                            type="button"
                            onClick={() => setReviewId(a.id)}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                              a.status === 'SUBMITTED' ? 'bg-red-700 text-white hover:bg-red-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {a.status === 'SUBMITTED' ? 'Grade' : 'Review'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
