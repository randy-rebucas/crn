'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';

type ContentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
type MaterialType = 'TEXT' | 'IMAGE' | 'PDF' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'DOWNLOAD' | 'FLASHCARD';

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
interface ModuleRecord {
  id: string;
  subjectId: string;
  name: string;
  position: number;
  status: ContentStatus;
}
interface LessonRecord {
  id: string;
  moduleId: string;
  name: string;
  position: number;
  status: ContentStatus;
}
interface MaterialRecord {
  id: string;
  lessonId: string;
  title: string;
  type: MaterialType;
  position: number;
  status: ContentStatus;
}

// Mirrors ALLOWED_CONTENT_TRANSITIONS in apps/api/src/modules/curriculum/curriculum.service.ts
const NEXT_STATUSES: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'REVIEW'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

const MATERIAL_TYPES: MaterialType[] = ['TEXT', 'IMAGE', 'PDF', 'DOCUMENT', 'VIDEO', 'AUDIO', 'DOWNLOAD', 'FLASHCARD'];

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

function StatusActions({
  status,
  canManage,
  onTransition,
  pending,
}: {
  status: ContentStatus;
  canManage: boolean;
  onTransition: (next: ContentStatus) => void;
  pending: boolean;
}) {
  const options = NEXT_STATUSES[status];
  if (!canManage || options.length === 0) return <StatusBadge status={status} />;
  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={status} />
      <Select
        defaultValue=""
        disabled={pending}
        onChange={(e) => {
          if (e.target.value) onTransition(e.target.value as ContentStatus);
        }}
        className="w-auto"
      >
        <option value="" disabled>
          Move to…
        </option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ')}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Materials (leaf of the tree)
// ---------------------------------------------------------------------------

const createMaterialSchema = z.object({
  title: z.string().min(1, 'Required'),
  type: z.enum(['TEXT', 'IMAGE', 'PDF', 'DOCUMENT', 'VIDEO', 'AUDIO', 'DOWNLOAD', 'FLASHCARD']),
  content: z.string().optional(),
});
type CreateMaterialValues = z.infer<typeof createMaterialSchema>;

function MaterialsPanel({ lessonId, canManage }: { lessonId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const materialsQuery = useQuery<MaterialRecord[]>({
    queryKey: ['materials', lessonId],
    queryFn: async () => (await apiClient.get('/v1/materials', { params: { lessonId } })).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaterialValues>({ resolver: zodResolver(createMaterialSchema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      apiClient.patch(`/v1/materials/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials', lessonId] }),
  });

  const onSubmit = async (values: CreateMaterialValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/materials', { lessonId, title: values.title, type: values.type, content: values.content || undefined });
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['materials', lessonId] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create material.'));
    }
  };

  return (
    <div className="ml-6 border-l border-slate-200 py-2 pl-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Materials</p>
        {canManage && (
          <Button variant="ghost" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close' : '+ Material'}
          </Button>
        )}
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New material">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Title" error={errors.title?.message}>
            <Input {...register('title')} />
          </Field>
          <Field label="Type">
            <Select {...register('type')}>
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Content / URL">
            <Input {...register('content')} placeholder="Text, or a storage key/URL" />
          </Field>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      </Drawer>

      {materialsQuery.isLoading && <LoadingState />}
      {materialsQuery.isError && <ErrorState message="Could not load materials." />}
      {!materialsQuery.isLoading && materialsQuery.data?.length === 0 && (
        <p className="text-xs text-slate-400">No materials yet.</p>
      )}
      <ul className="space-y-1.5">
        {materialsQuery.data?.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5 text-sm">
            <span className="text-slate-700">
              {m.title} <span className="text-xs text-slate-400">({m.type})</span>
            </span>
            <StatusActions
              status={m.status}
              canManage={canManage}
              pending={transition.isPending}
              onTransition={(status) => transition.mutate({ id: m.id, status })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

const createLessonSchema = z.object({ name: z.string().min(1, 'Required') });
type CreateLessonValues = z.infer<typeof createLessonSchema>;

function LessonsPanel({ moduleId, canManage }: { moduleId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  const lessonsQuery = useQuery<LessonRecord[]>({
    queryKey: ['lessons', moduleId],
    queryFn: async () => (await apiClient.get('/v1/lessons', { params: { moduleId } })).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLessonValues>({ resolver: zodResolver(createLessonSchema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      apiClient.patch(`/v1/lessons/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lessons', moduleId] }),
  });

  const onSubmit = async (values: CreateLessonValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/lessons', { moduleId, name: values.name });
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['lessons', moduleId] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create lesson.'));
    }
  };

  return (
    <div className="ml-6 border-l border-slate-200 py-2 pl-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lessons</p>
        {canManage && (
          <Button variant="ghost" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close' : '+ Lesson'}
          </Button>
        )}
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New lesson">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Name" error={errors.name?.message}>
            <Input {...register('name')} />
          </Field>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      </Drawer>

      {lessonsQuery.isLoading && <LoadingState />}
      {lessonsQuery.isError && <ErrorState message="Could not load lessons." />}
      {!lessonsQuery.isLoading && lessonsQuery.data?.length === 0 && (
        <p className="text-xs text-slate-400">No lessons yet.</p>
      )}
      <ul className="space-y-1.5">
        {lessonsQuery.data?.map((lesson) => (
          <li key={lesson.id} className="rounded bg-white">
            <div className="flex items-center justify-between px-1 py-1">
              <button
                type="button"
                className="text-sm font-medium text-slate-800 hover:underline"
                onClick={() => setExpandedLessonId(expandedLessonId === lesson.id ? null : lesson.id)}
              >
                {lesson.name}
              </button>
              <StatusActions
                status={lesson.status}
                canManage={canManage}
                pending={transition.isPending}
                onTransition={(status) => transition.mutate({ id: lesson.id, status })}
              />
            </div>
            {expandedLessonId === lesson.id && <MaterialsPanel lessonId={lesson.id} canManage={canManage} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

const createModuleSchema = z.object({ name: z.string().min(1, 'Required') });
type CreateModuleValues = z.infer<typeof createModuleSchema>;

function ModulesPanel({ subjectId, canManage }: { subjectId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  const modulesQuery = useQuery<ModuleRecord[]>({
    queryKey: ['modules', subjectId],
    queryFn: async () => (await apiClient.get('/v1/modules', { params: { subjectId } })).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateModuleValues>({ resolver: zodResolver(createModuleSchema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      apiClient.patch(`/v1/modules/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modules', subjectId] }),
  });

  const onSubmit = async (values: CreateModuleValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/modules', { subjectId, name: values.name });
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['modules', subjectId] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create module.'));
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Modules</h2>
        {canManage && (
          <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Close' : 'New Module'}
          </Button>
        )}
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New module">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Module 1: Foundations" />
          </Field>
          {serverError && <p className="text-xs text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add module'}
            </Button>
          </div>
        </form>
      </Drawer>

      {modulesQuery.isLoading && <LoadingState />}
      {modulesQuery.isError && <ErrorState message="Could not load modules." />}
      {!modulesQuery.isLoading && !modulesQuery.isError && modulesQuery.data?.length === 0 && (
        <EmptyState title="No modules yet" description="Add the first module for this subject." />
      )}

      <ul className="space-y-2">
        {modulesQuery.data?.map((mod) => (
          <li key={mod.id} className="rounded-md border border-slate-100">
            <div className="flex items-center justify-between px-3 py-2">
              <button
                type="button"
                className="text-sm font-semibold text-slate-900 hover:underline"
                onClick={() => setExpandedModuleId(expandedModuleId === mod.id ? null : mod.id)}
              >
                {mod.name}
              </button>
              <StatusActions
                status={mod.status}
                canManage={canManage}
                pending={transition.isPending}
                onTransition={(status) => transition.mutate({ id: mod.id, status })}
              />
            </div>
            {expandedModuleId === mod.id && <LessonsPanel moduleId={mod.id} canManage={canManage} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page: Program / Course / Subject picker
// ---------------------------------------------------------------------------

const createSubjectSchema = z.object({ name: z.string().min(1, 'Required'), description: z.string().optional() });
type CreateSubjectValues = z.infer<typeof createSubjectSchema>;

export default function CurriculumPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('courses.update');
  const queryClient = useQueryClient();

  const [programId, setProgramId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [showSubjectForm, setShowSubjectForm] = useState(false);

  const programsQuery = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });
  const effectiveProgramId = programId || programsQuery.data?.[0]?.id || '';

  const coursesQuery = useQuery<Course[]>({
    queryKey: ['courses', effectiveProgramId],
    queryFn: async () => (await apiClient.get('/v1/courses', { params: { programId: effectiveProgramId } })).data,
    enabled: Boolean(effectiveProgramId),
  });
  const effectiveCourseId = courseId || coursesQuery.data?.[0]?.id || '';

  const subjectsQuery = useQuery<Subject[]>({
    queryKey: ['subjects', effectiveCourseId],
    queryFn: async () => (await apiClient.get('/v1/subjects', { params: { courseId: effectiveCourseId } })).data,
    enabled: Boolean(effectiveCourseId),
  });
  const effectiveSubjectId = subjectId || subjectsQuery.data?.[0]?.id || '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubjectValues>({ resolver: zodResolver(createSubjectSchema) });
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const onCreateSubject = async (values: CreateSubjectValues) => {
    setSubjectError(null);
    try {
      await apiClient.post('/v1/subjects', { courseId: effectiveCourseId, name: values.name, description: values.description || undefined });
      reset();
      setShowSubjectForm(false);
      queryClient.invalidateQueries({ queryKey: ['subjects', effectiveCourseId] });
    } catch (err) {
      setSubjectError(errorMessage(err, 'Could not create subject.'));
    }
  };

  return (
    <div>
      <PageHeader
        title="Curriculum"
        description="Program → Course → Subject → Module → Lesson → Material, with each level moving through Draft → Review → Approved → Published → Archived."
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Program">
            <Select
              value={effectiveProgramId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setCourseId('');
                setSubjectId('');
              }}
              disabled={programsQuery.isLoading}
            >
              {(programsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Course">
            <Select
              value={effectiveCourseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setSubjectId('');
              }}
              disabled={!effectiveProgramId || coursesQuery.isLoading}
            >
              {(coursesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject">
            <Select
              value={effectiveSubjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!effectiveCourseId || subjectsQuery.isLoading}
            >
              {(subjectsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {!effectiveProgramId && !programsQuery.isLoading && (
        <EmptyState title="No programs yet" description="Create a program first, under the Programs page." />
      )}
      {effectiveProgramId && !effectiveCourseId && !coursesQuery.isLoading && (
        <EmptyState title="No courses yet" description="Create a course first, under the Courses page." />
      )}

      {effectiveCourseId && (
        <div className="mb-6">
          {canManage && (
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Subjects</h2>
              <Button variant="secondary" onClick={() => setShowSubjectForm((v) => !v)}>
                {showSubjectForm ? 'Close' : 'New Subject'}
              </Button>
            </div>
          )}
          <Drawer open={showSubjectForm} onClose={() => setShowSubjectForm(false)} title="New subject">
            <form onSubmit={handleSubmit(onCreateSubject)} className="flex flex-col gap-4">
              <Field label="Name" error={errors.name?.message}>
                <Input {...register('name')} />
              </Field>
              <Field label="Description">
                <Input {...register('description')} placeholder="Optional" />
              </Field>
              {subjectError && <p className="text-xs text-red-600">{subjectError}</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create subject'}
                </Button>
              </div>
            </form>
          </Drawer>
          {!subjectsQuery.isLoading && subjectsQuery.data?.length === 0 && (
            <EmptyState title="No subjects yet" description="Add the first subject for this course." />
          )}
        </div>
      )}

      {effectiveSubjectId && <ModulesPanel subjectId={effectiveSubjectId} canManage={canManage} />}
    </div>
  );
}
