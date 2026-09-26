'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Drawer, EmptyState, ErrorState, Field, Input, Select, StatusBadge } from '@/components/ui';
import {
  Chip,
  DIFFICULTY_TONES,
  EXAM_TYPES,
  EXAM_TYPE_META,
  type Exam,
  type ExamDetail,
  ExamTypeBadge,
  type ExamType,
  FilterChips,
  FormError,
  MANUAL_TYPES,
  type Program,
  QUESTION_TYPE_LABELS,
  SearchBox,
  SectionLabel,
  extractError,
  humanize,
  useAllQuestions,
} from './exams-shared';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createExamSchema = z.object({
  title: z.string().trim().min(1, 'Give the exam a title'),
  type: z.enum(EXAM_TYPES as unknown as [ExamType, ...ExamType[]]),
  programId: z.string().optional(),
  timeLimitMinutes: z.string().regex(/^\d*$/, 'Whole minutes only').optional(),
  passingScore: z.string().regex(/^\d+$/, 'Enter the pass mark in points'),
  attemptLimit: z.string().regex(/^\d*$/, 'Whole number').optional(),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  resultRelease: z.enum(['IMMEDIATE', 'DELAYED']),
});
type CreateExamValues = z.infer<typeof createExamSchema>;

function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
          checked ? 'bg-red-700' : 'bg-slate-300'
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function CreateExamForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { hasPermission } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const { data: programs } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
    enabled: hasPermission('programs.view'),
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateExamValues>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      type: 'PRACTICE',
      resultRelease: 'IMMEDIATE',
      shuffleQuestions: false,
      shuffleOptions: false,
      attemptLimit: '1',
    },
  });

  const onSubmit = async (values: CreateExamValues) => {
    setServerError(null);
    try {
      const { data } = await apiClient.post<Exam>('/v1/exams', {
        title: values.title.trim(),
        type: values.type,
        programId: values.programId || undefined,
        timeLimitMinutes: values.timeLimitMinutes ? Number(values.timeLimitMinutes) : undefined,
        passingScore: Number(values.passingScore),
        attemptLimit: values.attemptLimit ? Number(values.attemptLimit) : undefined,
        shuffleQuestions: values.shuffleQuestions,
        shuffleOptions: values.shuffleOptions,
        resultRelease: values.resultRelease,
      });
      onCreated(data.id);
    } catch (err) {
      setServerError(extractError(err, 'Could not create the exam.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <section className="space-y-3">
        <SectionLabel>Basics</SectionLabel>
        <Field label="Title" error={errors.title?.message}>
          <Input {...register('title')} placeholder="e.g. NLE Mock Exam 2" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Type</legend>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {EXAM_TYPES.map((t) => (
                  <label
                    key={t}
                    className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 has-[:checked]:border-red-700 has-[:checked]:bg-red-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-red-600"
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={t}
                      className="sr-only"
                      checked={field.value === t}
                      onChange={() => field.onChange(t)}
                    />
                    <span className="block text-sm font-medium text-slate-900">{EXAM_TYPE_META[t].label}</span>
                    <span className="block text-xs text-slate-500">{EXAM_TYPE_META[t].hint}</span>
                  </label>
                ))}
              </div>
            )}
          />
        </fieldset>
        <Field label="Program">
          <Select {...register('programId')}>
            <option value="">Not tied to a program</option>
            {(programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <SectionLabel>Scoring & timing</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pass mark (points)" error={errors.passingScore?.message}>
            <Input inputMode="numeric" {...register('passingScore')} placeholder="e.g. 75" />
          </Field>
          <Field label="Time limit (min)" error={errors.timeLimitMinutes?.message}>
            <Input inputMode="numeric" {...register('timeLimitMinutes')} placeholder="No limit" />
          </Field>
          <Field label="Attempts allowed" error={errors.attemptLimit?.message}>
            <Input inputMode="numeric" {...register('attemptLimit')} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          The pass mark is in points. Once questions are added, the builder shows it as a percentage of the total.
        </p>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-5">
        <SectionLabel>Delivery</SectionLabel>
        <Controller
          control={control}
          name="shuffleQuestions"
          render={({ field }) => (
            <Switch checked={field.value} onChange={field.onChange} label="Shuffle questions" description="Each student sees the questions in a different order." />
          )}
        />
        <Controller
          control={control}
          name="shuffleOptions"
          render={({ field }) => (
            <Switch checked={field.value} onChange={field.onChange} label="Shuffle answer options" description="Choices appear in a different order per student." />
          )}
        />
        <Controller
          control={control}
          name="resultRelease"
          render={({ field }) => (
            <Switch
              checked={field.value === 'IMMEDIATE'}
              onChange={(v) => field.onChange(v ? 'IMMEDIATE' : 'DELAYED')}
              label="Show results right away"
              description="Off: students see only their status until grading is finished."
            />
          )}
        />
      </section>

      <FormError message={serverError} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Next you&apos;ll add questions from the bank.</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create & add questions'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Still being authored: not yet published, and not retired to the archive. */
function isDraft(status: Exam['status']) {
  return status !== 'PUBLISHED' && status !== 'ARCHIVED';
}

function ExamBuilder({ examId }: { examId: string }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasPermission('exams.update');
  const canPublish = hasPermission('exams.publish');
  const [search, setSearch] = useState('');
  const [points, setPoints] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: exam, isLoading, isError } = useQuery<ExamDetail>({
    queryKey: ['exams', examId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${examId}`)).data,
  });
  // Only unpublished, unarchived exams can still be edited or published.
  const draft = exam ? isDraft(exam.status) : false;
  const bank = useAllQuestions();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['exams'] });
  };
  const add = useMutation({
    mutationFn: ({ questionId, pts }: { questionId: string; pts: number }) =>
      // Position is left to the API, which appends after the current last one.
      apiClient.post(`/v1/exams/${examId}/questions`, { questionId, points: pts }),
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError: (err) => setError(extractError(err, 'Could not add that question.')),
  });
  const remove = useMutation({
    mutationFn: (examQuestionId: string) => apiClient.delete(`/v1/exams/${examId}/questions/${examQuestionId}`),
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError: (err) => setError(extractError(err, 'Could not remove that question.')),
  });
  const publish = useMutation({
    mutationFn: () => apiClient.patch(`/v1/exams/${examId}/publish`),
    onMutate: () => setError(null),
    onSuccess: refresh,
    onError: (err) => setError(extractError(err, 'Could not publish the exam.')),
  });

  // Only reviewed questions can go on an exam (exams.service.ts#addQuestion).
  const onExam = new Set(exam?.questions.map((q) => q.questionId));
  const term = search.trim().toLowerCase();
  const available = (bank.data ?? []).filter(
    (x) =>
      (x.status === 'APPROVED' || x.status === 'PUBLISHED') &&
      !onExam.has(x.id) &&
      (!term || `${x.content} ${x.topic ?? ''} ${x.tags.join(' ')}`.toLowerCase().includes(term)),
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }
  if (isError || !exam) return <ErrorState message="Couldn't load this exam." />;

  const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);
  const passPct = totalPoints > 0 ? Math.round((exam.passingScore / totalPoints) * 100) : null;
  const manualCount = exam.questions.filter((q) => MANUAL_TYPES.has(q.question.type)).length;
  const checks = [
    { ok: exam.questions.length > 0, label: exam.questions.length > 0 ? `${exam.questions.length} questions added` : 'Add at least one question' },
    {
      ok: totalPoints >= exam.passingScore && totalPoints > 0,
      label:
        totalPoints >= exam.passingScore && totalPoints > 0
          ? `Pass mark ${exam.passingScore} of ${totalPoints} pts (${passPct}%)`
          : `Pass mark is ${exam.passingScore} pts but the questions only total ${totalPoints}`,
    },
  ];
  const ready = checks.every((c) => c.ok);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">{exam.title}</h3>
          <ExamTypeBadge type={exam.type} />
          <StatusBadge status={exam.status} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : 'No time limit'} · {exam.attemptLimit} attempt
          {exam.attemptLimit === 1 ? '' : 's'} · results {exam.resultRelease === 'IMMEDIATE' ? 'shown right away' : 'released after grading'}
          {exam.shuffleQuestions ? ' · shuffled' : ''}
        </p>
      </div>

      {draft && (
        <div className={`rounded-lg border px-4 py-3 ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <ul className="space-y-1.5 text-sm">
            {checks.map((c) => (
              <li key={c.label} className={`flex items-center gap-2 ${c.ok ? 'text-emerald-800' : 'text-amber-900'}`}>
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
                  {c.ok ? (
                    <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M12 8v5m0 3.5v.01" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
                  )}
                </svg>
                {c.label}
              </li>
            ))}
          </ul>
          {canPublish && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-3">
              <p className="text-xs text-slate-600">Publishing locks the question set and opens the exam to students.</p>
              <Button disabled={!ready || publish.isPending} onClick={() => publish.mutate()}>
                {publish.isPending ? 'Publishing…' : 'Publish exam'}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <SectionLabel>Questions on this exam</SectionLabel>
          <span className="text-xs tabular-nums text-slate-500">
            {totalPoints} pts{manualCount > 0 && ` · ${manualCount} graded by hand`}
          </span>
        </div>
        {exam.questions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            No questions yet. Add approved questions from the bank below.
          </p>
        ) : (
          <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {exam.questions.map((eq, i) => (
              <li key={eq.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className="w-5 shrink-0 pt-0.5 text-right text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-slate-900">{eq.question.content}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Chip>{QUESTION_TYPE_LABELS[eq.question.type]}</Chip>
                    <Chip tone={DIFFICULTY_TONES[eq.question.difficulty]}>{humanize(eq.question.difficulty)}</Chip>
                  </div>
                </div>
                <span className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-slate-700">
                  {eq.points} pt{eq.points === 1 ? '' : 's'}
                </span>
                {draft && canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove question ${i + 1}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(eq.id)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {draft && canEdit && (
        <section className="border-t border-slate-100 pt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <SectionLabel>Add from the question bank</SectionLabel>
          </div>
          <SearchBox value={search} onChange={setSearch} placeholder="Search approved questions" />
          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            {bank.isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Loading questions…</p>
            ) : available.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                {search ? 'No approved questions match.' : 'No more approved questions. Approve some in the Question Bank tab.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {available.map((q) => (
                  <li key={q.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-slate-800">{q.content}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Chip>{QUESTION_TYPE_LABELS[q.type]}</Chip>
                        <Chip tone={DIFFICULTY_TONES[q.difficulty]}>{humanize(q.difficulty)}</Chip>
                        {q.topic && <Chip tone="bg-red-50 text-red-700">{q.topic}</Chip>}
                      </div>
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                      <input
                        inputMode="numeric"
                        aria-label="Points"
                        value={points[q.id] ?? '1'}
                        onChange={(e) => setPoints((p) => ({ ...p, [q.id]: e.target.value.replace(/\D/g, '') }))}
                        className="w-12 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-red-600 focus:outline-none"
                      />
                      pts
                    </label>
                    <button
                      type="button"
                      disabled={add.isPending}
                      onClick={() => add.mutate({ questionId: q.id, pts: Math.max(1, Number(points[q.id] ?? '1') || 1) })}
                      className="shrink-0 rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

type ExamFilter = 'all' | 'draft' | 'PUBLISHED' | 'ARCHIVED';

export function ExamsTab({ createOpen, onCloseCreate }: { createOpen: boolean; onCloseCreate: () => void }) {
  const { hasPermission } = useAuth();
  const canSeeResults = hasPermission('exams.grade');
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  const exams = useMemo(() => data ?? [], [data]);
  const [filter, setFilter] = useState<ExamFilter>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const counts: Record<ExamFilter, number> = {
    all: exams.length,
    draft: exams.filter((e) => isDraft(e.status)).length,
    PUBLISHED: exams.filter((e) => e.status === 'PUBLISHED').length,
    ARCHIVED: exams.filter((e) => e.status === 'ARCHIVED').length,
  };
  const visible = exams.filter(
    (e) =>
      (filter === 'all' || (filter === 'draft' ? isDraft(e.status) : e.status === filter)) &&
      (!search.trim() || e.title.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <>
      <Drawer open={createOpen} onClose={onCloseCreate} title="New exam">
        {createOpen && (
          <CreateExamForm
            onCreated={(id) => {
              onCloseCreate();
              queryClient.invalidateQueries({ queryKey: ['exams'] });
              setOpenId(id);
            }}
          />
        )}
      </Drawer>
      <Drawer open={openId !== null} onClose={() => setOpenId(null)} title="Exam builder">
        {openId && <ExamBuilder key={openId} examId={openId} />}
      </Drawer>

      {isError && <ErrorState message="Couldn't load exams. Refresh the page to try again." />}
      {data && exams.length === 0 && (
        <EmptyState title="No exams yet" description="Create an exam, then fill it with approved questions from the bank." />
      )}

      {(isLoading || exams.length > 0) && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <FilterChips
              label="Filter exams"
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'all', label: 'All', count: counts.all },
                { id: 'draft', label: 'Drafts', count: counts.draft },
                { id: 'PUBLISHED', label: 'Published', count: counts.PUBLISHED },
                ...(counts.ARCHIVED ? [{ id: 'ARCHIVED' as const, label: 'Archived', count: counts.ARCHIVED }] : []),
              ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Search exams" />
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="px-4 py-14 text-center text-sm text-slate-500">No exams match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Exam</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Questions</th>
                    <th scope="col" className="px-4 py-3 font-medium">Pass mark</th>
                    <th scope="col" className="px-4 py-3 font-medium">Format</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Attempts</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((exam) => {
                    const qCount = exam._count?.questions;
                    const attempts = exam._count?.attempts ?? 0;
                    const editable = isDraft(exam.status);
                    return (
                      <tr key={exam.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setOpenId(exam.id)}
                              className="rounded text-left font-medium text-slate-900 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
                            >
                              {exam.title}
                            </button>
                            <ExamTypeBadge type={exam.type} />
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{exam.program?.name ?? 'No program'}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {qCount === undefined ? '—' : qCount === 0 ? <span className="text-xs font-medium text-amber-700">None yet</span> : qCount}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">{exam.passingScore} pts</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <p>{exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : 'Untimed'}</p>
                          <p className="text-slate-400">
                            {exam.attemptLimit} attempt{exam.attemptLimit === 1 ? '' : 's'}
                            {exam.resultRelease === 'DELAYED' ? ' · delayed results' : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{attempts}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={exam.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {attempts > 0 && canSeeResults && (
                              <Link
                                href="/results"
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                              >
                                Results
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => setOpenId(exam.id)}
                              className={`rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                                editable ? 'bg-red-700 text-white hover:bg-red-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {editable ? 'Build' : 'View'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
