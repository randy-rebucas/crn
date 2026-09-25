'use client';

import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Field, Select } from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';

// ---------------------------------------------------------------------------
// Types (mirror apps/api/src/modules/{questions,exams,attempts})
// ---------------------------------------------------------------------------

export interface Program {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  name: string;
  programId: string;
}

export interface Subject {
  id: string;
  name: string;
  courseId: string;
}

export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_RESPONSE'
  | 'TRUE_FALSE'
  | 'IDENTIFICATION'
  | 'NUMERICAL'
  | 'ESSAY'
  | 'IMAGE_BASED';

export type Difficulty = 'EASY' | 'MODERATE' | 'DIFFICULT';
export type ContentStatusValue = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
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

export type ExamType = 'PRACTICE' | 'DIAGNOSTIC' | 'MOCK' | 'FINAL';
export type ResultRelease = 'IMMEDIATE' | 'DELAYED';

export interface Exam {
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
  program?: { id: string; name: string } | null;
  _count?: { questions: number; attempts: number };
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  points: number;
  position: number;
  question: Question;
}

export interface ExamDetail extends Exam {
  questions: ExamQuestion[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const QUESTION_TYPES: QuestionType[] = [
  'MULTIPLE_CHOICE',
  'MULTIPLE_RESPONSE',
  'TRUE_FALSE',
  'IDENTIFICATION',
  'NUMERICAL',
  'ESSAY',
  'IMAGE_BASED',
];
export const DIFFICULTIES: Difficulty[] = ['EASY', 'MODERATE', 'DIFFICULT'];
export const EXAM_TYPES: ExamType[] = ['PRACTICE', 'DIAGNOSTIC', 'MOCK', 'FINAL'];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Multiple choice',
  MULTIPLE_RESPONSE: 'Multiple response',
  TRUE_FALSE: 'True / false',
  IDENTIFICATION: 'Identification',
  NUMERICAL: 'Numerical',
  ESSAY: 'Essay',
  IMAGE_BASED: 'Image-based',
};

/** Types that need a person to grade them. */
export const MANUAL_TYPES = new Set<QuestionType>(['ESSAY', 'IMAGE_BASED']);

export const EXAM_TYPE_META: Record<ExamType, { label: string; tone: string; hint: string }> = {
  PRACTICE: { label: 'Practice', tone: 'bg-slate-100 text-slate-700', hint: 'Low-stakes drills students can repeat' },
  DIAGNOSTIC: { label: 'Diagnostic', tone: 'bg-slate-900 text-white', hint: 'Finds weak areas at the start of review' },
  MOCK: { label: 'Mock', tone: 'bg-amber-100 text-amber-800', hint: 'Full board-exam simulation' },
  FINAL: { label: 'Final', tone: 'bg-red-100 text-red-700', hint: 'Counts toward completion' },
};

export const DIFFICULTY_TONES: Record<Difficulty, string> = {
  EASY: 'bg-emerald-50 text-emerald-700',
  MODERATE: 'bg-amber-50 text-amber-700',
  DIFFICULT: 'bg-red-50 text-red-700',
};

// Mirrors ALLOWED_TRANSITIONS in apps/api/src/modules/questions/questions.service.ts
// (UX-only — the API re-validates every transition). Labels name the action.
export const QUESTION_ACTIONS: Record<ContentStatusValue, { to: ContentStatusValue; label: string; primary?: boolean }[]> = {
  DRAFT: [{ to: 'REVIEW', label: 'Send for review', primary: true }],
  REVIEW: [
    { to: 'APPROVED', label: 'Approve', primary: true },
    { to: 'DRAFT', label: 'Return to draft' },
  ],
  APPROVED: [
    { to: 'PUBLISHED', label: 'Publish', primary: true },
    { to: 'REVIEW', label: 'Back to review' },
  ],
  PUBLISHED: [{ to: 'ARCHIVED', label: 'Archive' }],
  ARCHIVED: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractError(err: unknown, fallback: string): string {
  const message = isAxiosError<{ message?: string | string[] }>(err) ? err.response?.data?.message : undefined;
  if (Array.isArray(message)) return message.join('. ');
  return message ?? fallback;
}

export function humanize(value: string) {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function useAllQuestions() {
  return useQuery<Question[]>({
    queryKey: ['questions', 'all'],
    queryFn: async () => (await apiClient.get('/v1/questions')).data,
  });
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

export function ExamTypeBadge({ type }: { type: ExamType }) {
  const meta = EXAM_TYPE_META[type];
  return (
    <span title={meta.hint} className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

export function Chip({ children, tone = 'bg-slate-100 text-slate-600' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>{children}</span>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block sm:w-64">
      <span className="sr-only">{placeholder}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{baseIcons.search}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
      />
    </label>
  );
}

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; count?: number; alert?: boolean }[];
  label: string;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label={label}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
              active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={`ml-1.5 tabular-nums ${
                  active ? 'text-red-100' : o.alert && o.count > 0 ? 'font-semibold text-red-700' : 'text-slate-400'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

// ---------------------------------------------------------------------------
// Program → Course → Subject picker
// ---------------------------------------------------------------------------

export function useProgramCourseSubject() {
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
    reset: () => {
      setProgramId('');
      setCourseId('');
      setSubjectId('');
    },
  };
}

export function SubjectCascadePicker({
  picker,
  compact,
}: {
  picker: ReturnType<typeof useProgramCourseSubject>;
  compact?: boolean;
}) {
  const selectClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-red-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400';
  if (compact) {
    return (
      <>
        <select aria-label="Program" value={picker.programId} onChange={(e) => picker.setProgramId(e.target.value)} className={selectClass}>
          <option value="">All programs</option>
          {picker.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Course"
          value={picker.courseId}
          onChange={(e) => picker.setCourseId(e.target.value)}
          disabled={!picker.programId}
          className={selectClass}
        >
          <option value="">All courses</option>
          {picker.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Subject"
          value={picker.subjectId}
          onChange={(e) => picker.setSubjectId(e.target.value)}
          disabled={!picker.courseId}
          className={selectClass}
        >
          <option value="">All subjects</option>
          {picker.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </>
    );
  }
  return (
    <>
      <Field label="Program">
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
        <Select value={picker.courseId} onChange={(e) => picker.setCourseId(e.target.value)} disabled={!picker.programId}>
          <option value="">Select course…</option>
          {picker.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Subject">
        <Select value={picker.subjectId} onChange={(e) => picker.setSubjectId(e.target.value)} disabled={!picker.courseId}>
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

/** Renders a question's answer key readably; null when it's been redacted. */
export function describeAnswer(q: Pick<Question, 'type' | 'options' | 'correctAnswer'>): string | null {
  const answer = q.correctAnswer;
  if (answer === undefined || answer === null || answer === '') return null;
  const optionText = (id: unknown) => q.options?.find((o) => o.id === id)?.text ?? String(id);
  switch (q.type) {
    case 'MULTIPLE_CHOICE':
      return optionText(answer);
    case 'MULTIPLE_RESPONSE':
      return Array.isArray(answer) ? answer.map(optionText).join(', ') : String(answer);
    case 'TRUE_FALSE':
      return answer === true || answer === 'true' ? 'True' : 'False';
    default:
      return typeof answer === 'string' ? answer : JSON.stringify(answer);
  }
}
