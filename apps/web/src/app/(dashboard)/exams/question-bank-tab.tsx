'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button, Card, Drawer, EmptyState, ErrorState, Field, Input, Select, StatusBadge, Textarea } from '@/components/ui';
import {
  type ContentStatusValue,
  Chip,
  DIFFICULTIES,
  DIFFICULTY_TONES,
  type Difficulty,
  FilterChips,
  FormError,
  QUESTION_ACTIONS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type Question,
  type QuestionOption,
  type QuestionType,
  SearchBox,
  SectionLabel,
  SubjectCascadePicker,
  describeAnswer,
  extractError,
  humanize,
  useProgramCourseSubject,
} from './exams-shared';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES as unknown as [QuestionType, ...QuestionType[]]),
  difficulty: z.enum(DIFFICULTIES as unknown as [Difficulty, ...Difficulty[]]).optional().or(z.literal('')),
  topic: z.string().optional(),
  tags: z.string().optional(),
  content: z.string().trim().min(1, 'Write the question'),
  explanation: z.string().optional(),
  reference: z.string().optional(),
});
type CreateQuestionValues = z.infer<typeof createQuestionSchema>;

const LETTERS = 'ABCDEFGHIJ';

function CreateQuestionForm({ onCreated }: { onCreated: () => void }) {
  const picker = useProgramCourseSubject();
  const [serverError, setServerError] = useState<string | null>(null);
  const [optionTexts, setOptionTexts] = useState<string[]>(['', '', '', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [correctOptionIndexes, setCorrectOptionIndexes] = useState<number[]>([]);
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<'true' | 'false'>('true');
  const [textAnswer, setTextAnswer] = useState('');

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateQuestionValues>({
    resolver: zodResolver(createQuestionSchema),
    defaultValues: { type: 'MULTIPLE_CHOICE', difficulty: '' },
  });

  const type = useWatch({ control, name: 'type' });
  const isChoiceType = type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_RESPONSE';

  const onSubmit = async (values: CreateQuestionValues) => {
    setServerError(null);
    if (!picker.subjectId) {
      setServerError('Choose the program, course and subject this question belongs to.');
      return;
    }

    const options: QuestionOption[] = isChoiceType
      ? optionTexts.map((text, index) => ({ id: `opt-${index}`, text: text.trim() })).filter((opt) => opt.text.length > 0)
      : [];

    if (isChoiceType && options.length < 2) {
      setServerError('Add at least two answer options.');
      return;
    }
    if (type === 'MULTIPLE_RESPONSE' && correctOptionIndexes.length === 0) {
      setServerError('Mark at least one option as correct.');
      return;
    }
    if ((type === 'IDENTIFICATION' || type === 'NUMERICAL') && !textAnswer.trim()) {
      setServerError('Enter the correct answer so it can be auto-graded.');
      return;
    }

    let correctAnswer: unknown;
    switch (values.type) {
      case 'MULTIPLE_CHOICE':
        correctAnswer = `opt-${correctOptionIndex}`;
        break;
      case 'MULTIPLE_RESPONSE':
        correctAnswer = correctOptionIndexes.map((i) => `opt-${i}`).filter((id) => options.some((o) => o.id === id));
        break;
      case 'TRUE_FALSE':
        correctAnswer = trueFalseAnswer === 'true';
        break;
      case 'NUMERICAL':
        correctAnswer = Number(textAnswer);
        break;
      default:
        correctAnswer = textAnswer;
        break;
    }

    try {
      await apiClient.post('/v1/questions', {
        subjectId: picker.subjectId,
        type: values.type,
        difficulty: values.difficulty || undefined,
        topic: values.topic?.trim() || undefined,
        tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        content: values.content.trim(),
        options: isChoiceType ? options : undefined,
        correctAnswer,
        explanation: values.explanation?.trim() || undefined,
        reference: values.reference?.trim() || undefined,
      });
      reset();
      setOptionTexts(['', '', '', '']);
      setCorrectOptionIndex(0);
      setCorrectOptionIndexes([]);
      setTextAnswer('');
      onCreated();
    } catch (err) {
      setServerError(extractError(err, 'Could not save the question.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <section className="space-y-3">
        <SectionLabel>Where it belongs</SectionLabel>
        <div className="grid gap-3">
          <SubjectCascadePicker picker={picker} />
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <SectionLabel>Question</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select {...register('type')}>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select {...register('difficulty')}>
              <option value="">Moderate (default)</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {humanize(d)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Question" error={errors.content?.message}>
          <Textarea {...register('content')} rows={4} placeholder="e.g. Which assessment finding is an early sign of hypoxia?" />
        </Field>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <SectionLabel>Answer key</SectionLabel>

        {isChoiceType && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              {type === 'MULTIPLE_CHOICE' ? 'Select the one correct option.' : 'Tick every correct option.'}
            </p>
            {optionTexts.map((text, index) => {
              const correct = type === 'MULTIPLE_CHOICE' ? correctOptionIndex === index : correctOptionIndexes.includes(index);
              return (
                <div
                  key={index}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${correct ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}
                >
                  <label className="flex shrink-0 cursor-pointer items-center gap-2">
                    {type === 'MULTIPLE_CHOICE' ? (
                      <input
                        type="radio"
                        name="correctOption"
                        aria-label={`Option ${LETTERS[index]} is correct`}
                        checked={correctOptionIndex === index}
                        onChange={() => setCorrectOptionIndex(index)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        aria-label={`Option ${LETTERS[index]} is correct`}
                        checked={correctOptionIndexes.includes(index)}
                        onChange={(e) =>
                          setCorrectOptionIndexes((prev) => (e.target.checked ? [...prev, index] : prev.filter((i) => i !== index)))
                        }
                        className="h-4 w-4 accent-emerald-600"
                      />
                    )}
                    <span className="w-4 text-sm font-semibold text-slate-500">{LETTERS[index]}</span>
                  </label>
                  <input
                    value={text}
                    aria-label={`Option ${LETTERS[index]}`}
                    placeholder={`Option ${LETTERS[index]}`}
                    onChange={(e) => setOptionTexts((prev) => prev.map((t, i) => (i === index ? e.target.value : t)))}
                    className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm focus:outline-none focus:ring-0"
                  />
                  {optionTexts.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove option ${LETTERS[index]}`}
                      onClick={() => {
                        setOptionTexts((prev) => prev.filter((_, i) => i !== index));
                        setCorrectOptionIndex((c) => (c === index ? 0 : c > index ? c - 1 : c));
                        setCorrectOptionIndexes((prev) => prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
            {optionTexts.length < LETTERS.length && (
              <button
                type="button"
                onClick={() => setOptionTexts((prev) => [...prev, ''])}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                + Add option
              </button>
            )}
          </div>
        )}

        {type === 'TRUE_FALSE' && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Correct answer">
            {(['true', 'false'] as const).map((v) => (
              <label
                key={v}
                className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800"
              >
                <input type="radio" className="sr-only" checked={trueFalseAnswer === v} onChange={() => setTrueFalseAnswer(v)} />
                {v === 'true' ? 'True' : 'False'}
              </label>
            ))}
          </div>
        )}

        {(type === 'IDENTIFICATION' || type === 'NUMERICAL') && (
          <Field label={type === 'NUMERICAL' ? 'Correct number' : 'Correct answer'}>
            <Input value={textAnswer} inputMode={type === 'NUMERICAL' ? 'decimal' : undefined} onChange={(e) => setTextAnswer(e.target.value)} />
          </Field>
        )}

        {(type === 'ESSAY' || type === 'IMAGE_BASED') && (
          <Field label="Model answer or rubric">
            <Textarea value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} rows={3} placeholder="Shown to the grader only" />
          </Field>
        )}
        {(type === 'ESSAY' || type === 'IMAGE_BASED') && (
          <p className="-mt-1 text-xs text-slate-500">This type is graded by hand from the Grading tab.</p>
        )}

        <Field label="Explanation">
          <Textarea {...register('explanation')} rows={2} placeholder="Why the answer is right. Shown to students after results are released." />
        </Field>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <SectionLabel>Organize</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Topic">
            <Input {...register('topic')} placeholder="e.g. Oxygenation" />
          </Field>
          <Field label="Tags">
            <Input {...register('tags')} placeholder="Comma-separated" />
          </Field>
        </div>
        <Field label="Reference">
          <Input {...register('reference')} placeholder="Book, chapter or page (optional)" />
        </Field>
      </section>

      <FormError message={serverError} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Saved as a draft. Send it for review when ready.</p>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save question'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function QuestionPreview({ q }: { q: Question }) {
  const answer = describeAnswer(q);
  const correctIds = new Set(
    q.type === 'MULTIPLE_CHOICE' ? [q.correctAnswer] : Array.isArray(q.correctAnswer) ? q.correctAnswer : [],
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status={q.status} />
        <Chip>{QUESTION_TYPE_LABELS[q.type]}</Chip>
        <Chip tone={DIFFICULTY_TONES[q.difficulty]}>{humanize(q.difficulty)}</Chip>
        {q.topic && <Chip tone="bg-red-50 text-red-700">{q.topic}</Chip>}
      </div>
      <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-900">{q.content}</p>

      {q.options && q.options.length > 0 && (
        <ol className="space-y-2">
          {q.options.map((o, i) => {
            const correct = correctIds.has(o.id);
            return (
              <li
                key={o.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                  correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700'
                }`}
              >
                <span className="font-semibold">{LETTERS[i]}.</span>
                <span className="flex-1">{o.text}</span>
                {correct && <span className="text-xs font-semibold text-emerald-700">Correct</span>}
              </li>
            );
          })}
        </ol>
      )}

      {!q.options?.length && (
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
          <p className="text-xs font-medium text-slate-500">Answer key</p>
          <p className="mt-0.5 text-slate-900">{answer ?? 'Hidden for your role'}</p>
        </div>
      )}

      {q.explanation && (
        <div>
          <SectionLabel>Explanation</SectionLabel>
          <p className="mt-1 text-sm text-slate-700">{q.explanation}</p>
        </div>
      )}
      {(q.reference || q.tags.length > 0) && (
        <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
          {q.reference && (
            <p className="text-slate-600">
              <span className="font-medium text-slate-700">Reference: </span>
              {q.reference}
            </p>
          )}
          {q.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {q.tags.map((t) => (
                <Chip key={t}>#{t}</Chip>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-slate-400">Added {new Date(q.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | ContentStatusValue;

export function QuestionBankTab({ createOpen, onCloseCreate }: { createOpen: boolean; onCloseCreate: () => void }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canReview = hasPermission('exams.approve');
  const picker = useProgramCourseSubject();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<QuestionType | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<Question[]>({
    queryKey: ['questions', picker.subjectId || 'all'],
    queryFn: async () => (await apiClient.get('/v1/questions', { params: { subjectId: picker.subjectId || undefined } })).data,
  });
  const questions = useMemo(() => data ?? [], [data]);

  const review = useMutation({
    mutationFn: ({ id, to }: { id: string; to: ContentStatusValue }) => apiClient.patch(`/v1/questions/${id}/status`, { status: to }),
    onMutate: () => setActionError(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
    onError: (err) => setActionError(extractError(err, 'Could not change that question’s status.')),
  });

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: questions.length, DRAFT: 0, REVIEW: 0, APPROVED: 0, PUBLISHED: 0, ARCHIVED: 0 };
    for (const q of questions) c[q.status] += 1;
    return c;
  }, [questions]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter(
      (x) =>
        (status === 'all' || x.status === status) &&
        (!type || x.type === type) &&
        (!difficulty || x.difficulty === difficulty) &&
        (!q || `${x.content} ${x.topic ?? ''} ${x.tags.join(' ')}`.toLowerCase().includes(q)),
    );
  }, [questions, status, type, difficulty, search]);

  const preview = questions.find((q) => q.id === previewId) ?? null;
  const hasFilters = Boolean(search || type || difficulty || picker.programId || status !== 'all');
  const selectClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-red-600 focus:outline-none';

  return (
    <>
      <Drawer open={createOpen} onClose={onCloseCreate} title="New question">
        {createOpen && (
          <CreateQuestionForm
            onCreated={() => {
              onCloseCreate();
              queryClient.invalidateQueries({ queryKey: ['questions'] });
            }}
          />
        )}
      </Drawer>
      <Drawer open={preview !== null} onClose={() => setPreviewId(null)} title="Question">
        {preview && <QuestionPreview q={preview} />}
      </Drawer>

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <FilterChips
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[
                { id: 'all', label: 'All', count: counts.all },
                { id: 'DRAFT', label: 'Draft', count: counts.DRAFT },
                { id: 'REVIEW', label: 'In review', count: counts.REVIEW, alert: canReview },
                { id: 'APPROVED', label: 'Approved', count: counts.APPROVED },
                { id: 'PUBLISHED', label: 'Published', count: counts.PUBLISHED },
                ...(counts.ARCHIVED ? [{ id: 'ARCHIVED' as const, label: 'Archived', count: counts.ARCHIVED }] : []),
              ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Search text, topic or tag" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <SubjectCascadePicker picker={picker} compact />
            <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as QuestionType | '')} className={selectClass}>
              <option value="">All types</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              aria-label="Difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty | '')}
              className={selectClass}
            >
              <option value="">Any difficulty</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {humanize(d)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {actionError && (
          <div role="alert" className="flex justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {actionError}
            <button type="button" onClick={() => setActionError(null)} className="text-xs font-medium hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {isError && (
          <div className="p-4">
            <ErrorState message="Couldn't load the question bank. Refresh the page to try again." />
          </div>
        )}
        {isLoading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
        {data && questions.length === 0 && !hasFilters && (
          <div className="p-4">
            <EmptyState title="The question bank is empty" description="Write questions, get them approved, then use them to build exams." />
          </div>
        )}
        {data && visible.length === 0 && (questions.length > 0 || hasFilters) && (
          <p className="px-4 py-14 text-center text-sm text-slate-500">
            No questions match.{' '}
            <button
              type="button"
              onClick={() => {
                setStatus('all');
                setType('');
                setDifficulty('');
                setSearch('');
                picker.reset();
              }}
              className="font-medium text-red-700 hover:underline"
            >
              Clear filters
            </button>
          </p>
        )}

        {visible.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {visible.map((q) => {
              const actions = canReview ? QUESTION_ACTIONS[q.status] : [];
              const busy = review.isPending && review.variables?.id === q.id;
              return (
                <li key={q.id} className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 lg:flex-row lg:items-center">
                  <button
                    type="button"
                    onClick={() => setPreviewId(q.id)}
                    className="min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    <p className="line-clamp-2 text-sm text-slate-900">{q.content}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip>{QUESTION_TYPE_LABELS[q.type]}</Chip>
                      <Chip tone={DIFFICULTY_TONES[q.difficulty]}>{humanize(q.difficulty)}</Chip>
                      {q.topic && <Chip tone="bg-red-50 text-red-700">{q.topic}</Chip>}
                      {q.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[11px] text-slate-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:justify-end">
                    <StatusBadge status={q.status} />
                    {actions.map((a) => (
                      <button
                        key={a.to}
                        type="button"
                        disabled={busy}
                        onClick={() => review.mutate({ id: q.id, to: a.to })}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 ${
                          a.primary ? 'bg-red-700 text-white hover:bg-red-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {busy ? 'Saving…' : a.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
