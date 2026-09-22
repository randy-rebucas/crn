'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';

// ---------------------------------------------------------------------------
// Shared types (mirrors apps/api/src/modules/{questions,exams,attempts})
// ---------------------------------------------------------------------------

interface Program {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
  programId: string;
}

interface Subject {
  id: string;
  name: string;
  courseId: string;
}

type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_RESPONSE'
  | 'TRUE_FALSE'
  | 'IDENTIFICATION'
  | 'NUMERICAL'
  | 'ESSAY'
  | 'IMAGE_BASED';

type Difficulty = 'EASY' | 'MODERATE' | 'DIFFICULT';
type ContentStatusValue = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  id: string;
  subjectId: string;
  type: QuestionType;
  difficulty: Difficulty;
  topic: string | null;
  tags: string[];
  content: string;
  options: QuestionOption[] | null;
  correctAnswer: unknown;
  explanation: string | null;
  reference: string | null;
  status: ContentStatusValue;
  createdAt: string;
}

type ExamType = 'PRACTICE' | 'DIAGNOSTIC' | 'MOCK' | 'FINAL';
type ResultRelease = 'IMMEDIATE' | 'DELAYED';

interface Exam {
  id: string;
  organizationId: string;
  programId: string | null;
  title: string;
  type: ExamType;
  timeLimitMinutes: number | null;
  passingScore: number;
  attemptLimit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  resultRelease: ResultRelease;
  status: ContentStatusValue;
  createdAt: string;
}

interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  points: number;
  position: number;
  question: Question;
}

interface ExamDetail extends Exam {
  questions: ExamQuestion[];
}

type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

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
  student: { id: string };
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

const QUESTION_TYPES: QuestionType[] = [
  'MULTIPLE_CHOICE',
  'MULTIPLE_RESPONSE',
  'TRUE_FALSE',
  'IDENTIFICATION',
  'NUMERICAL',
  'ESSAY',
  'IMAGE_BASED',
];

const DIFFICULTIES: Difficulty[] = ['EASY', 'MODERATE', 'DIFFICULT'];
const CONTENT_STATUSES: ContentStatusValue[] = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];
const EXAM_TYPES: ExamType[] = ['PRACTICE', 'DIAGNOSTIC', 'MOCK', 'FINAL'];

// Mirrors ALLOWED_TRANSITIONS in apps/api/src/modules/questions/questions.service.ts
// (UX-only convenience — the API re-validates every transition).
const QUESTION_NEXT_STATUSES: Record<ContentStatusValue, ContentStatusValue[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'REVIEW'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

function extractError(err: unknown, fallback: string): string {
  const message = isAxiosError<{ message?: string | string[] }>(err) ? err.response?.data?.message : undefined;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}

// ---------------------------------------------------------------------------
// Program / Course / Subject cascading picker (shared by filter + create form)
// ---------------------------------------------------------------------------

function useProgramCourseSubject() {
  const [programId, setProgramId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  const programs = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });

  const courses = useQuery<Course[]>({
    queryKey: ['courses', programId],
    queryFn: async () => (await apiClient.get('/v1/courses', { params: { programId } })).data,
    enabled: Boolean(programId),
  });

  const subjects = useQuery<Subject[]>({
    queryKey: ['subjects', courseId],
    queryFn: async () => (await apiClient.get('/v1/subjects', { params: { courseId } })).data,
    enabled: Boolean(courseId),
  });

  return {
    programId,
    setProgramId: (v: string) => {
      setProgramId(v);
      setCourseId('');
      setSubjectId('');
    },
    courseId,
    setCourseId: (v: string) => {
      setCourseId(v);
      setSubjectId('');
    },
    subjectId,
    setSubjectId,
    programs: programs.data ?? [],
    courses: courses.data ?? [],
    subjects: subjects.data ?? [],
  };
}

function SubjectCascadePicker({
  picker,
  required,
}: {
  picker: ReturnType<typeof useProgramCourseSubject>;
  required?: boolean;
}) {
  return (
    <>
      <Field label={`Program${required ? '' : ' (optional)'}`}>
        <Select value={picker.programId} onChange={(e) => picker.setProgramId(e.target.value)}>
          <option value="">Select program…</option>
          {picker.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Course">
        <Select
          value={picker.courseId}
          onChange={(e) => picker.setCourseId(e.target.value)}
          disabled={!picker.programId}
        >
          <option value="">Select course…</option>
          {picker.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Subject">
        <Select
          value={picker.subjectId}
          onChange={(e) => picker.setSubjectId(e.target.value)}
          disabled={!picker.courseId}
        >
          <option value="">Select subject…</option>
          {picker.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// Question Bank — create form
// ---------------------------------------------------------------------------

const createQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES as unknown as [QuestionType, ...QuestionType[]]),
  difficulty: z.enum(DIFFICULTIES as unknown as [Difficulty, ...Difficulty[]]).optional(),
  topic: z.string().optional(),
  tags: z.string().optional(),
  content: z.string().min(1, 'Required'),
  explanation: z.string().optional(),
  reference: z.string().optional(),
});
type CreateQuestionValues = z.infer<typeof createQuestionSchema>;

function CreateQuestionForm({ onCreated }: { onCreated: () => void }) {
  const picker = useProgramCourseSubject();
  const [serverError, setServerError] = useState<string | null>(null);
  const [optionTexts, setOptionTexts] = useState<string[]>(['', '']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [correctOptionIndexes, setCorrectOptionIndexes] = useState<number[]>([]);
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<'true' | 'false'>('true');
  const [textAnswer, setTextAnswer] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateQuestionValues>({
    resolver: zodResolver(createQuestionSchema),
    defaultValues: { type: 'MULTIPLE_CHOICE' },
  });

  const type = watch('type');
  const isChoiceType = type === 'MULTIPLE_CHOICE' || type === 'MULTIPLE_RESPONSE';

  const onSubmit = async (values: CreateQuestionValues) => {
    setServerError(null);
    if (!picker.subjectId) {
      setServerError('Select a program, course, and subject.');
      return;
    }

    const options: QuestionOption[] = isChoiceType
      ? optionTexts
          .map((text, index) => ({ id: `opt-${index}`, text: text.trim() }))
          .filter((opt) => opt.text.length > 0)
      : [];

    let correctAnswer: unknown;
    switch (values.type) {
      case 'MULTIPLE_CHOICE':
        correctAnswer = options[correctOptionIndex]?.id ?? options[0]?.id;
        break;
      case 'MULTIPLE_RESPONSE':
        correctAnswer = correctOptionIndexes.map((i) => options[i]?.id).filter(Boolean);
        break;
      case 'TRUE_FALSE':
        correctAnswer = trueFalseAnswer === 'true';
        break;
      case 'NUMERICAL':
        correctAnswer = Number(textAnswer);
        break;
      case 'IDENTIFICATION':
      case 'ESSAY':
      case 'IMAGE_BASED':
      default:
        correctAnswer = textAnswer;
        break;
    }

    try {
      await apiClient.post('/v1/questions', {
        subjectId: picker.subjectId,
        type: values.type,
        difficulty: values.difficulty,
        topic: values.topic || undefined,
        tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        content: values.content,
        options: isChoiceType ? options : undefined,
        correctAnswer,
        explanation: values.explanation || undefined,
        reference: values.reference || undefined,
      });
      reset();
      setOptionTexts(['', '']);
      setCorrectOptionIndex(0);
      setCorrectOptionIndexes([]);
      setTextAnswer('');
      onCreated();
    } catch (err) {
      setServerError(extractError(err, 'Could not create question.'));
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">New question</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-3">
        <SubjectCascadePicker picker={picker} required />

        <Field label="Type">
          <Select {...register('type')}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select {...register('difficulty')}>
            <option value="">Default (Moderate)</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Topic">
          <Input {...register('topic')} placeholder="Optional" />
        </Field>

        <div className="sm:col-span-3">
          <Field label="Question content" error={errors.content?.message}>
            <textarea
              {...register('content')}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
            />
          </Field>
        </div>

        {isChoiceType && (
          <div className="sm:col-span-3 space-y-2 rounded-md border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">
              Options ({type === 'MULTIPLE_CHOICE' ? 'select the one correct answer' : 'check all correct answers'})
            </p>
            {optionTexts.map((text, index) => (
              <div key={index} className="flex items-center gap-2">
                {type === 'MULTIPLE_CHOICE' ? (
                  <input
                    type="radio"
                    name="correctOption"
                    checked={correctOptionIndex === index}
                    onChange={() => setCorrectOptionIndex(index)}
                  />
                ) : (
                  <input
                    type="checkbox"
                    checked={correctOptionIndexes.includes(index)}
                    onChange={(e) =>
                      setCorrectOptionIndexes((prev) =>
                        e.target.checked ? [...prev, index] : prev.filter((i) => i !== index),
                      )
                    }
                  />
                )}
                <Input
                  value={text}
                  placeholder={`Option ${index + 1}`}
                  onChange={(e) =>
                    setOptionTexts((prev) => prev.map((t, i) => (i === index ? e.target.value : t)))
                  }
                />
                {optionTexts.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOptionTexts((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setOptionTexts((prev) => [...prev, ''])}>
              Add option
            </Button>
          </div>
        )}

        {type === 'TRUE_FALSE' && (
          <Field label="Correct answer">
            <Select value={trueFalseAnswer} onChange={(e) => setTrueFalseAnswer(e.target.value as 'true' | 'false')}>
              <option value="true">True</option>
              <option value="false">False</option>
            </Select>
          </Field>
        )}

        {(type === 'IDENTIFICATION' || type === 'NUMERICAL') && (
          <Field label={type === 'NUMERICAL' ? 'Correct numeric answer' : 'Correct answer'}>
            <Input
              value={textAnswer}
              type={type === 'NUMERICAL' ? 'number' : 'text'}
              onChange={(e) => setTextAnswer(e.target.value)}
            />
          </Field>
        )}

        {(type === 'ESSAY' || type === 'IMAGE_BASED') && (
          <div className="sm:col-span-3">
            <Field label="Model answer / grading rubric (used only as a reference for the manual grader)">
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
              />
            </Field>
          </div>
        )}

        <div className="sm:col-span-3">
          <Field label="Explanation">
            <Input {...register('explanation')} placeholder="Optional" />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Reference">
            <Input {...register('reference')} placeholder="Optional" />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Tags">
            <Input {...register('tags')} placeholder="Comma-separated, optional" />
          </Field>
        </div>

        <div className="sm:col-span-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create question'}
          </Button>
          {serverError && <p className="mt-2 text-sm text-red-600">{serverError}</p>}
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Question Bank tab
// ---------------------------------------------------------------------------

function QuestionBankTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const filterPicker = useProgramCourseSubject();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, isError } = useQuery<Question[]>({
    queryKey: ['questions', filterPicker.subjectId, statusFilter],
    queryFn: async () =>
      (
        await apiClient.get('/v1/questions', {
          params: {
            subjectId: filterPicker.subjectId || undefined,
            status: statusFilter || undefined,
          },
        })
      ).data,
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/v1/questions/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="grid flex-1 gap-4 sm:grid-cols-4">
          <SubjectCascadePicker picker={filterPicker} />
          <Field label="Status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {hasPermission('exams.create') && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Question'}</Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <CreateQuestionForm
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['questions'] });
            }}
          />
        </div>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load questions." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No questions" description="No questions match the current filters." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Content</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Difficulty</th>
                <th className="px-4 py-3">Status</th>
                {hasPermission('exams.approve') && <th className="px-4 py-3 text-right">Move to</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((q) => {
                const nextOptions = QUESTION_NEXT_STATUSES[q.status] ?? [];
                return (
                  <tr key={q.id}>
                    <td className="max-w-sm px-4 py-3 text-slate-900">{q.content}</td>
                    <td className="px-4 py-3 text-slate-600">{q.topic ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{q.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-slate-600">{q.difficulty}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
                    </td>
                    {hasPermission('exams.approve') && (
                      <td className="px-4 py-3 text-right">
                        {nextOptions.length > 0 ? (
                          <Select
                            defaultValue=""
                            disabled={review.isPending}
                            onChange={(e) => {
                              if (e.target.value) review.mutate({ id: q.id, status: e.target.value });
                            }}
                          >
                            <option value="" disabled>
                              Choose status…
                            </option>
                            {nextOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs text-slate-400">Final</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exams tab
// ---------------------------------------------------------------------------

const createExamSchema = z.object({
  title: z.string().min(1, 'Required'),
  type: z.enum(EXAM_TYPES as unknown as [ExamType, ...ExamType[]]),
  programId: z.string().optional(),
  timeLimitMinutes: z.string().optional(),
  passingScore: z.string().min(1, 'Required'),
  attemptLimit: z.string().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  resultRelease: z.enum(['IMMEDIATE', 'DELAYED']).optional(),
});
type CreateExamValues = z.infer<typeof createExamSchema>;

function CreateExamForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { data: programs } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateExamValues>({
    resolver: zodResolver(createExamSchema),
    defaultValues: { type: 'PRACTICE', resultRelease: 'IMMEDIATE' },
  });

  const onSubmit = async (values: CreateExamValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/exams', {
        title: values.title,
        type: values.type,
        programId: values.programId || undefined,
        timeLimitMinutes: values.timeLimitMinutes ? Number(values.timeLimitMinutes) : undefined,
        passingScore: Number(values.passingScore),
        attemptLimit: values.attemptLimit ? Number(values.attemptLimit) : undefined,
        shuffleQuestions: values.shuffleQuestions ?? false,
        shuffleOptions: values.shuffleOptions ?? false,
        resultRelease: values.resultRelease,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(extractError(err, 'Could not create exam.'));
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">New exam</h2>
      <p className="mb-4 text-xs text-slate-500">
        Questions are added to the exam individually from the Question Bank after it is created (each exam question
        pulls one approved/published question at a time — see “Manage questions” below).
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-3">
        <Field label="Title" error={errors.title?.message}>
          <Input {...register('title')} />
        </Field>
        <Field label="Type">
          <Select {...register('type')}>
            {EXAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Program">
          <Select {...register('programId')}>
            <option value="">None</option>
            {(programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Time limit (minutes)">
          <Input type="number" {...register('timeLimitMinutes')} placeholder="Optional" />
        </Field>
        <Field label="Passing score" error={errors.passingScore?.message}>
          <Input type="number" {...register('passingScore')} />
        </Field>
        <Field label="Attempt limit">
          <Input type="number" {...register('attemptLimit')} placeholder="Default 1" />
        </Field>
        <Field label="Result release">
          <Select {...register('resultRelease')}>
            <option value="IMMEDIATE">Immediate</option>
            <option value="DELAYED">Delayed</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" {...register('shuffleQuestions')} />
          Shuffle questions
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" {...register('shuffleOptions')} />
          Shuffle options
        </label>

        <div className="sm:col-span-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create exam'}
          </Button>
          {serverError && <p className="mt-2 text-sm text-red-600">{serverError}</p>}
        </div>
      </form>
    </Card>
  );
}

function AddExamQuestionForm({ examId, onAdded }: { examId: string; onAdded: () => void }) {
  const [questionId, setQuestionId] = useState('');
  const [points, setPoints] = useState('1');
  const [error, setError] = useState<string | null>(null);

  // Only approved/published questions can be attached to an exam
  // (apps/api/src/modules/exams/exams.service.ts#addQuestion).
  const { data: approved } = useQuery<Question[]>({
    queryKey: ['questions', 'APPROVED'],
    queryFn: async () => (await apiClient.get('/v1/questions', { params: { status: 'APPROVED' } })).data,
  });
  const { data: published } = useQuery<Question[]>({
    queryKey: ['questions', 'PUBLISHED'],
    queryFn: async () => (await apiClient.get('/v1/questions', { params: { status: 'PUBLISHED' } })).data,
  });
  const options = [...(approved ?? []), ...(published ?? [])];

  const addQuestion = useMutation({
    mutationFn: () =>
      apiClient.post(`/v1/exams/${examId}/questions`, { questionId, points: Number(points) || 1 }),
    onSuccess: () => {
      setQuestionId('');
      setPoints('1');
      setError(null);
      onAdded();
    },
    onError: (err) => setError(extractError(err, 'Could not add question.')),
  });

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <Field label="Question">
        <Select value={questionId} onChange={(e) => setQuestionId(e.target.value)}>
          <option value="">Select approved/published question…</option>
          {options.map((q) => (
            <option key={q.id} value={q.id}>
              {q.content.slice(0, 60)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Points">
        <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="w-20" />
      </Field>
      <Button
        type="button"
        disabled={!questionId || addQuestion.isPending}
        onClick={() => addQuestion.mutate()}
      >
        Add to exam
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ExamDetailPanel({ examId, canManage }: { examId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<ExamDetail>({
    queryKey: ['exams', examId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${examId}`)).data,
  });

  if (isLoading) return <LoadingState />;
  if (!data) return null;

  return (
    <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Questions ({data.questions.length})
      </p>
      {data.questions.length === 0 ? (
        <p className="text-sm text-slate-500">No questions added yet.</p>
      ) : (
        <ul className="space-y-1 text-sm text-slate-700">
          {data.questions.map((eq) => (
            <li key={eq.id} className="flex justify-between rounded bg-white px-3 py-2 shadow-sm">
              <span>{eq.question.content}</span>
              <span className="text-slate-400">{eq.points} pt</span>
            </li>
          ))}
        </ul>
      )}
      {canManage && data.status !== 'PUBLISHED' && (
        <AddExamQuestionForm
          examId={examId}
          onAdded={() => queryClient.invalidateQueries({ queryKey: ['exams', examId] })}
        />
      )}
    </div>
  );
}

function ExamsTab() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });

  const publish = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/exams/${id}/publish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {hasPermission('exams.create') && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Exam'}</Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <CreateExamForm
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['exams'] });
            }}
          />
        </div>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load exams." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No exams yet" description="Create an exam to get started." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Passing score</th>
                <th className="px-4 py-3">Time limit</th>
                <th className="px-4 py-3">Attempt limit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((exam) => (
                <React.Fragment key={exam.id}>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-900">{exam.title}</td>
                    <td className="px-4 py-3 text-slate-600">{exam.type}</td>
                    <td className="px-4 py-3 text-slate-600">{exam.passingScore}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{exam.attemptLimit}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={exam.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => setExpandedId(expandedId === exam.id ? null : exam.id)}>
                        {expandedId === exam.id ? 'Hide' : 'Manage questions'}
                      </Button>
                      {hasPermission('exams.publish') && exam.status !== 'PUBLISHED' && (
                        <Button variant="ghost" disabled={publish.isPending} onClick={() => publish.mutate(exam.id)}>
                          Publish
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expandedId === exam.id && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <ExamDetailPanel examId={exam.id} canManage={hasPermission('exams.update')} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grading tab (manual grading of essay / image-based answers)
// ---------------------------------------------------------------------------

function GradeAttemptRow({ attempt, onGraded }: { attempt: Attempt; onGraded: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery<AttemptDetail>({
    queryKey: ['attempt-detail', attempt.id],
    queryFn: async () => (await apiClient.get(`/v1/attempts/${attempt.id}`)).data,
    enabled: expanded,
  });

  const grade = useMutation({
    mutationFn: ({ questionId, pointsAwarded }: { questionId: string; pointsAwarded: number }) =>
      apiClient.patch(`/v1/attempts/${attempt.id}/answers/${questionId}/grade`, { pointsAwarded }),
    onSuccess: onGraded,
  });

  return (
    <>
      <tr>
        <td className="px-4 py-3 text-slate-600">{attempt.student.id}</td>
        <td className="px-4 py-3">
          <StatusBadge status={attempt.status} />
        </td>
        <td className="px-4 py-3 text-slate-600">
          {attempt.score ?? '—'} / {attempt.maxScore ?? '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide' : 'Review answers'}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-slate-50 p-4">
            {isLoading && <LoadingState />}
            {data && (
              <ul className="space-y-2">
                {data.answers.map((answer) => (
                  <li key={answer.id} className="rounded bg-white p-3 shadow-sm">
                    <p className="text-sm font-medium text-slate-900">{answer.question.content}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Response: {typeof answer.response === 'string' ? answer.response : JSON.stringify(answer.response)}
                    </p>
                    {answer.needsManualGrading ? (
                      <GradeInput
                        onSubmit={(points) => grade.mutate({ questionId: answer.questionId, pointsAwarded: points })}
                        disabled={grade.isPending}
                      />
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        Auto-graded — {answer.isCorrect ? 'correct' : 'incorrect'} ({answer.pointsAwarded ?? 0} pt)
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function GradeInput({ onSubmit, disabled }: { onSubmit: (points: number) => void; disabled: boolean }) {
  const [points, setPoints] = useState('0');
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        type="number"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="w-24"
      />
      <Button type="button" disabled={disabled} onClick={() => onSubmit(Number(points))}>
        Award points
      </Button>
    </div>
  );
}

function GradingTab() {
  const { data: exams } = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  const [examId, setExamId] = useState('');
  const queryClient = useQueryClient();

  const { data: attempts, isLoading, isError } = useQuery<Attempt[]>({
    queryKey: ['attempts', examId],
    queryFn: async () => (await apiClient.get('/v1/attempts', { params: { examId } })).data,
    enabled: Boolean(examId),
  });

  return (
    <div>
      <div className="mb-4 max-w-sm">
        <Field label="Exam">
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select an exam…</option>
            {(exams ?? []).map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!examId && <EmptyState title="Select an exam" description="Choose an exam to view its attempts and grade manually-graded answers." />}
      {examId && isLoading && <LoadingState />}
      {examId && isError && <ErrorState message="Could not load attempts." />}
      {examId && attempts && attempts.length === 0 && (
        <EmptyState title="No attempts yet" description="No students have attempted this exam." />
      )}

      {examId && attempts && attempts.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.map((attempt) => (
                <GradeAttemptRow
                  key={attempt.id}
                  attempt={attempt}
                  onGraded={() => {
                    queryClient.invalidateQueries({ queryKey: ['attempt-detail', attempt.id] });
                    queryClient.invalidateQueries({ queryKey: ['attempts', examId] });
                  }}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'questions' | 'exams' | 'grading';

export default function ExamsPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>('questions');

  const tabs: { key: Tab; label: string; visible: boolean }[] = [
    { key: 'questions', label: 'Question Bank', visible: true },
    { key: 'exams', label: 'Exams', visible: true },
    { key: 'grading', label: 'Grading', visible: hasPermission('exams.grade') },
  ];

  return (
    <div>
      <PageHeader
        title="Exams"
        description="The question bank and exam engine — author questions, assemble exams, and grade attempts."
      />

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs
          .filter((t) => t.visible)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-b-2 border-red-700 text-red-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === 'questions' && <QuestionBankTab />}
      {tab === 'exams' && <ExamsTab />}
      {tab === 'grading' && hasPermission('exams.grade') && <GradingTab />}
    </div>
  );
}
