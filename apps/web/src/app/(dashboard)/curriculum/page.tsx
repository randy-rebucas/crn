'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  Textarea,
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
  description?: string | null;
  status?: ContentStatus;
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
  content?: string | null;
  position: number;
  status: ContentStatus;
}

const STAGES: ContentStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];

const STAGE_META: Record<ContentStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: '#94a3b8' },
  REVIEW: { label: 'In review', color: '#2563eb' },
  APPROVED: { label: 'Approved', color: '#d97706' },
  PUBLISHED: { label: 'Published', color: '#059669' },
  ARCHIVED: { label: 'Archived', color: '#cbd5e1' },
};

// Mirrors ALLOWED_CONTENT_TRANSITIONS in apps/api/src/modules/curriculum/curriculum.service.ts,
// named for what each move means. The first entry is the forward step.
const TRANSITIONS: Record<ContentStatus, { to: ContentStatus; label: string; tone: 'primary' | 'secondary' }[]> = {
  DRAFT: [{ to: 'REVIEW', label: 'Submit for review', tone: 'primary' }],
  REVIEW: [
    { to: 'APPROVED', label: 'Approve', tone: 'primary' },
    { to: 'DRAFT', label: 'Send back', tone: 'secondary' },
  ],
  APPROVED: [
    { to: 'PUBLISHED', label: 'Publish', tone: 'primary' },
    { to: 'REVIEW', label: 'Return to review', tone: 'secondary' },
  ],
  PUBLISHED: [{ to: 'ARCHIVED', label: 'Archive', tone: 'secondary' }],
  ARCHIVED: [],
};

const MATERIAL_TYPES: MaterialType[] = ['TEXT', 'VIDEO', 'PDF', 'DOCUMENT', 'IMAGE', 'AUDIO', 'DOWNLOAD', 'FLASHCARD'];

const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const TYPE_META: Record<MaterialType, { label: string; icon: React.ReactNode }> = {
  TEXT: {
    label: 'Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M5 6h14M5 10h14M5 14h9M5 18h11" {...stroke} />
      </svg>
    ),
  },
  VIDEO: {
    label: 'Video',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <rect x={3.5} y={5.5} width={17} height={13} rx={2} {...stroke} />
        <path d="m10.5 9.5 4 2.5-4 2.5v-5Z" {...stroke} />
      </svg>
    ),
  },
  PDF: {
    label: 'PDF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M7 3.5h7l4 4V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z" {...stroke} />
        <path d="M14 3.5V8h4M8.5 14.5h7" {...stroke} />
      </svg>
    ),
  },
  DOCUMENT: {
    label: 'Document',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M7 3.5h7l4 4V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z" {...stroke} />
        <path d="M14 3.5V8h4M8.5 12.5h7M8.5 16h5" {...stroke} />
      </svg>
    ),
  },
  IMAGE: {
    label: 'Image',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <rect x={3.5} y={4.5} width={17} height={15} rx={2} {...stroke} />
        <circle cx={9} cy={10} r={1.6} {...stroke} />
        <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" {...stroke} />
      </svg>
    ),
  },
  AUDIO: {
    label: 'Audio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2" {...stroke} />
      </svg>
    ),
  },
  DOWNLOAD: {
    label: 'Download',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" {...stroke} />
      </svg>
    ),
  },
  FLASHCARD: {
    label: 'Flashcards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
        <rect x={6.5} y={7.5} width={14} height={11} rx={1.8} {...stroke} />
        <path d="M3.5 15V6.8a1.3 1.3 0 0 1 1.3-1.3H16" {...stroke} />
      </svg>
    ),
  },
};

const icons = {
  book: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 6.5C4 5.7 4.7 5 6 5h5v14H6c-1.3 0-2-.7-2-1.5v-11ZM20 6.5c0-.8-.7-1.5-2-1.5h-5v14h5c1.3 0 2-.7 2-1.5v-11Z" {...stroke} />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 3.5 8 4.3-8 4.3-8-4.3 8-4.3Z" {...stroke} />
      <path d="m4 12.3 8 4.3 8-4.3M4 16.3l8 4.3 8-4.3" {...stroke} />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" {...stroke} />
      <circle cx={4.8} cy={6.5} r={1} fill="currentColor" />
      <circle cx={4.8} cy={12} r={1} fill="currentColor" />
      <circle cx={4.8} cy={17.5} r={1} fill="currentColor" />
    </svg>
  ),
  paperclip: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m19 11.5-6.8 6.8a4.5 4.5 0 0 1-6.4-6.4l7.2-7.2a3 3 0 0 1 4.3 4.3l-7.1 7.1a1.5 1.5 0 0 1-2.1-2.1l6.4-6.4" {...stroke} />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m5.5 12.5 4 4 9-9.5" {...stroke} strokeWidth={1.9} />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" {...stroke} />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v4.2a1.3 1.3 0 0 1-1.3 1.3H5.8a1.3 1.3 0 0 1-1.3-1.3V7.8a1.3 1.3 0 0 1 1.3-1.3H10" {...stroke} />
    </svg>
  ),
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

function byPosition<T extends { position: number }>(list: T[] | undefined) {
  return [...(list ?? [])].sort((a, b) => a.position - b.position);
}

function SectionCard({
  icon,
  title,
  meta,
  action,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-700">{icon}</span>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {meta && <span className="text-xs text-slate-400">{meta}</span>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

// --- Status actions (per row: own pending state, own error) -----------------

function StatusActions({
  endpoint,
  id,
  status,
  invalidateKey,
  canManage,
}: {
  endpoint: '/v1/modules' | '/v1/lessons' | '/v1/materials';
  id: string;
  status: ContentStatus;
  invalidateKey: unknown[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transition = useMutation({
    mutationFn: (next: ContentStatus) => apiClient.patch(`${endpoint}/${id}/status`, { status: next }),
    onSuccess: () => {
      setError(null);
      setConfirmArchive(false);
      return queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (err) => setError(errorMessage(err, 'Could not change the status. Try again.')),
  });

  const options = TRANSITIONS[status];
  if (!canManage || options.length === 0) return null;
  const pendingTo = transition.isPending ? transition.variables : null;
  const small = '!px-2 !py-1 text-xs';

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {options.map((opt) => {
          const isArchive = opt.to === 'ARCHIVED';
          if (isArchive && confirmArchive) {
            return (
              <span key={opt.to} className="flex items-center gap-1.5">
                <span className="hidden text-xs text-slate-600 sm:inline">Permanent.</span>
                <Button variant="danger" className={small} disabled={transition.isPending} onClick={() => transition.mutate(opt.to)}>
                  {pendingTo === opt.to ? 'Archiving…' : 'Confirm archive'}
                </Button>
                <Button variant="ghost" className={small} disabled={transition.isPending} onClick={() => setConfirmArchive(false)}>
                  Cancel
                </Button>
              </span>
            );
          }
          return (
            <Button
              key={opt.to}
              variant={opt.tone}
              className={small}
              disabled={transition.isPending}
              onClick={() => (isArchive ? setConfirmArchive(true) : transition.mutate(opt.to))}
            >
              {pendingTo === opt.to ? 'Saving…' : opt.label}
            </Button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-red-700 sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}

// --- Create drawer ----------------------------------------------------------

type CreateTarget =
  | { kind: 'subject'; courseId: string }
  | { kind: 'module'; subjectId: string }
  | { kind: 'lesson'; moduleId: string; moduleName: string }
  | { kind: 'material'; lessonId: string; lessonName: string };

const nameSchema = z.object({ name: z.string().trim().min(1, 'Give it a name'), description: z.string().optional() });
type NameValues = z.infer<typeof nameSchema>;

function NameForm({ target, onDone }: { target: Exclude<CreateTarget, { kind: 'material' }>; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (values: NameValues) => {
    setServerError(null);
    try {
      if (target.kind === 'subject') {
        await apiClient.post('/v1/subjects', {
          courseId: target.courseId,
          name: values.name,
          description: values.description || undefined,
        });
        await queryClient.invalidateQueries({ queryKey: ['subjects', target.courseId] });
      } else if (target.kind === 'module') {
        await apiClient.post('/v1/modules', { subjectId: target.subjectId, name: values.name });
        await queryClient.invalidateQueries({ queryKey: ['modules', target.subjectId] });
      } else {
        await apiClient.post('/v1/lessons', { moduleId: target.moduleId, name: values.name });
        await queryClient.invalidateQueries({ queryKey: ['lessons', target.moduleId] });
      }
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, `Could not create the ${target.kind}. Try again.`));
    }
  };

  const placeholder =
    target.kind === 'subject' ? 'e.g. Medical-Surgical Nursing' : target.kind === 'module' ? 'e.g. Cardiovascular Disorders' : 'e.g. Heart Failure';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {target.kind === 'lesson' && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Adding to <span className="font-medium text-slate-800">{target.moduleName}</span>
        </p>
      )}
      <Field label="Name" error={formState.errors.name?.message}>
        <Input placeholder={placeholder} {...register('name')} />
      </Field>
      {target.kind === 'subject' && (
        <Field label="Description">
          <Textarea {...register('description')} rows={4} placeholder="Optional — what this subject covers" />
        </Field>
      )}
      {target.kind !== 'subject' && (
        <p className="text-xs text-slate-500">It starts as a draft and is added at the end of the list.</p>
      )}
      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Saving…' : `Add ${target.kind}`}
        </Button>
      </div>
    </form>
  );
}

const materialSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the material a title'),
    type: z.enum(['TEXT', 'IMAGE', 'PDF', 'DOCUMENT', 'VIDEO', 'AUDIO', 'DOWNLOAD', 'FLASHCARD']),
    content: z.string().optional(),
  })
  .refine((v) => v.type === 'TEXT' || !v.content || /^(https?:\/\/|[\w./-]+$)/.test(v.content.trim()), {
    path: ['content'],
    message: 'Enter a link (https://…) or a storage key',
  });
type MaterialValues = z.infer<typeof materialSchema>;

function MaterialForm({ target, onDone }: { target: Extract<CreateTarget, { kind: 'material' }>; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, control, setValue, formState } = useForm<MaterialValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: { title: '', type: 'TEXT', content: '' },
  });
  const type = useWatch({ control, name: 'type' });

  const onSubmit = async (values: MaterialValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/materials', {
        lessonId: target.lessonId,
        title: values.title,
        type: values.type,
        content: values.content?.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['materials', target.lessonId] });
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not add the material. Try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Adding to <span className="font-medium text-slate-800">{target.lessonName}</span>
      </p>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Type</span>
        <input type="hidden" {...register('type')} />
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Material type">
          {MATERIAL_TYPES.map((t) => {
            const on = type === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setValue('type', t, { shouldValidate: true })}
                className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                  on ? 'border-red-700 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {TYPE_META[t].icon}
                {TYPE_META[t].label}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Title" error={formState.errors.title?.message}>
        <Input placeholder="e.g. Heart Failure Lecture" {...register('title')} />
      </Field>
      {type === 'TEXT' ? (
        <Field label="Content" error={formState.errors.content?.message}>
          <Textarea rows={6} placeholder="Optional — the reading itself" {...register('content')} />
        </Field>
      ) : (
        <Field label="Link or storage key" error={formState.errors.content?.message}>
          <Input placeholder="https://… (optional)" {...register('content')} />
        </Field>
      )}
      <p className="text-xs text-slate-500">It starts as a draft and is added at the end of the lesson.</p>
      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Saving…' : 'Add material'}
        </Button>
      </div>
    </form>
  );
}

const CREATE_TITLES: Record<CreateTarget['kind'], string> = {
  subject: 'New subject',
  module: 'New module',
  lesson: 'New lesson',
  material: 'New material',
};

// --- Outline ----------------------------------------------------------------

function MaterialRow({ material, canManage }: { material: MaterialRecord; canManage: boolean }) {
  const isLink = material.content && /^https?:\/\//.test(material.content);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 pl-2 pr-1">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600" title={TYPE_META[material.type].label}>
        {TYPE_META[material.type].icon}
      </span>
      <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm text-slate-800">{material.title}</span>
          <StatusBadge status={material.status} />
        </div>
        <div className="text-xs text-slate-500">
          {TYPE_META[material.type].label}
          {isLink && (
            <>
              {' · '}
              <a
                href={material.content ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-red-700 underline-offset-2 hover:underline"
              >
                Open {icons.external}
              </a>
            </>
          )}
        </div>
      </div>
      <StatusActions
        endpoint="/v1/materials"
        id={material.id}
        status={material.status}
        invalidateKey={['materials', material.lessonId]}
        canManage={canManage}
      />
    </li>
  );
}

function LessonRow({
  lesson,
  materials,
  canManage,
  onAddMaterial,
}: {
  lesson: LessonRecord;
  materials: MaterialRecord[] | undefined;
  canManage: boolean;
  onAddMaterial: () => void;
}) {
  const [open, setOpen] = useState(false);
  const types = [...new Set((materials ?? []).map((m) => m.type))];
  return (
    <li className="py-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 basis-full items-center gap-2 text-left sm:basis-0 sm:flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          <Chevron open={open} />
          <span className="truncate text-sm font-medium text-slate-800">{lesson.name}</span>
          <StatusBadge status={lesson.status} />
          <span className="ml-1 hidden items-center gap-1 text-slate-400 sm:flex" aria-label={`${materials?.length ?? 0} materials`}>
            {types.map((t) => (
              <span key={t} title={TYPE_META[t].label}>
                {TYPE_META[t].icon}
              </span>
            ))}
            <span className="text-xs tabular-nums">{materials ? materials.length : '…'}</span>
          </span>
        </button>
        <StatusActions
          endpoint="/v1/lessons"
          id={lesson.id}
          status={lesson.status}
          invalidateKey={['lessons', lesson.moduleId]}
          canManage={canManage}
        />
      </div>
      {open && (
        <div className="ml-4 border-l border-slate-200 pl-3">
          {materials === undefined ? (
            <LoadingState />
          ) : materials.length === 0 ? (
            <p className="py-2 pl-2 text-xs text-slate-500">No materials yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {materials.map((m) => (
                <MaterialRow key={m.id} material={m} canManage={canManage} />
              ))}
            </ul>
          )}
          {canManage && (
            <button
              type="button"
              onClick={onAddMaterial}
              className="my-1 ml-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
            >
              {icons.plus} Add material
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ModuleBlock({
  index,
  mod,
  lessons,
  materialsByLesson,
  canManage,
  defaultOpen,
  onCreate,
}: {
  index: number;
  mod: ModuleRecord;
  lessons: LessonRecord[] | undefined;
  materialsByLesson: Map<string, MaterialRecord[] | undefined>;
  canManage: boolean;
  defaultOpen: boolean;
  onCreate: (t: CreateTarget) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total = lessons?.length ?? 0;
  const live = (lessons ?? []).filter((l) => l.status === 'PUBLISHED').length;
  return (
    <li className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 basis-full items-center gap-3 text-left sm:basis-0 sm:flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          <Chevron open={open} />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold tabular-nums text-white">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">{mod.name}</span>
              <StatusBadge status={mod.status} />
            </span>
            <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-emerald-600"
                  style={{ width: `${total ? (live / total) * 100 : 0}%` }}
                />
              </span>
              {lessons ? `${live} of ${total} lessons live` : 'Loading lessons…'}
            </span>
          </span>
        </button>
        <StatusActions
          endpoint="/v1/modules"
          id={mod.id}
          status={mod.status}
          invalidateKey={['modules', mod.subjectId]}
          canManage={canManage}
        />
      </div>
      {open && (
        <div className="border-t border-slate-100 px-3 py-2">
          {lessons === undefined ? (
            <LoadingState />
          ) : lessons.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-500">No lessons in this module yet.</p>
          ) : (
            <ul>
              {lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  materials={materialsByLesson.get(lesson.id)}
                  canManage={canManage}
                  onAddMaterial={() => onCreate({ kind: 'material', lessonId: lesson.id, lessonName: lesson.name })}
                />
              ))}
            </ul>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => onCreate({ kind: 'lesson', moduleId: mod.id, moduleName: mod.name })}
              className="mx-2 my-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
            >
              {icons.plus} Add lesson
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// --- Subject workspace ------------------------------------------------------

function SubjectWorkspace({
  subject,
  canManage,
  onCreate,
}: {
  subject: Subject;
  canManage: boolean;
  onCreate: (t: CreateTarget) => void;
}) {
  const modulesQuery = useQuery<ModuleRecord[]>({
    queryKey: ['modules', subject.id],
    queryFn: async () => (await apiClient.get('/v1/modules', { params: { subjectId: subject.id } })).data,
  });
  const modules = byPosition(modulesQuery.data);

  const lessonQueries = useQueries({
    queries: modules.map((m) => ({
      queryKey: ['lessons', m.id],
      queryFn: async (): Promise<LessonRecord[]> => (await apiClient.get('/v1/lessons', { params: { moduleId: m.id } })).data,
    })),
  });
  const lessonsByModule = new Map(modules.map((m, i) => [m.id, lessonQueries[i]?.data ? byPosition(lessonQueries[i].data) : undefined]));
  const allLessons = [...lessonsByModule.values()].flatMap((l) => l ?? []);

  const materialQueries = useQueries({
    queries: allLessons.map((l) => ({
      queryKey: ['materials', l.id],
      queryFn: async (): Promise<MaterialRecord[]> => (await apiClient.get('/v1/materials', { params: { lessonId: l.id } })).data,
    })),
  });
  const materialsByLesson = new Map(
    allLessons.map((l, i) => [l.id, materialQueries[i]?.data ? byPosition(materialQueries[i].data) : undefined]),
  );
  const allMaterials = [...materialsByLesson.values()].flatMap((m) => m ?? []);

  const loadingTree = modulesQuery.isLoading || lessonQueries.some((q) => q.isLoading);
  const everything = [...modules, ...allLessons, ...allMaterials];
  const liveShare = everything.length
    ? Math.round((everything.filter((i) => i.status === 'PUBLISHED').length / everything.length) * 100)
    : null;

  const chartData = modules.map((m, i) => {
    const row: Record<string, string | number> = { name: `M${i + 1}`, fullName: m.name };
    for (const s of STAGES) row[s] = (lessonsByModule.get(m.id) ?? []).filter((l) => l.status === s).length;
    return row;
  });

  const typeCounts = MATERIAL_TYPES.map((t) => ({ type: t, count: allMaterials.filter((m) => m.type === t).length })).filter(
    (t) => t.count > 0,
  );
  const maxType = Math.max(1, ...typeCounts.map((t) => t.count));

  return (
    <div className="min-w-0 space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{subject.name}</h2>
              {subject.status && <StatusBadge status={subject.status} />}
            </div>
            {subject.description && <p className="mt-1 max-w-prose text-sm text-slate-600">{subject.description}</p>}
          </div>
          {canManage && (
            <Button onClick={() => onCreate({ kind: 'module', subjectId: subject.id })} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New module
            </Button>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
          {[
            { icon: icons.layers, label: 'Modules', value: modules.length },
            { icon: icons.list, label: 'Lessons', value: loadingTree ? '…' : allLessons.length },
            { icon: icons.paperclip, label: 'Materials', value: loadingTree ? '…' : allMaterials.length },
            { icon: icons.check, label: 'Live on the portal', value: liveShare === null ? '—' : `${liveShare}%` },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">{stat.icon}</span>
              <div>
                <dd className="text-base font-semibold tabular-nums text-slate-900">{stat.value}</dd>
                <dt className="text-xs text-slate-500">{stat.label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      {modules.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-5">
          <SectionCard icon={icons.barChart} title="Lesson status by module" className="xl:col-span-3">
            {loadingTree ? (
              <LoadingState />
            ) : allLessons.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No lessons yet to chart.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(150, modules.length * 40 + 30)}>
                  <BarChart data={chartData} layout="vertical" barCategoryGap="30%" margin={{ left: 0, right: 8 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={32} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                      formatter={(value, key) => [value, STAGE_META[key as ContentStatus]?.label ?? String(key)]}
                    />
                    {STAGES.map((s) => (
                      <Bar key={s} dataKey={s} stackId="l" fill={STAGE_META[s].color} isAnimationActive={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {STAGES.map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STAGE_META[s].color }} />
                      {STAGE_META[s].label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard icon={icons.paperclip} title="Materials by type" className="xl:col-span-2">
            {loadingTree || materialQueries.some((q) => q.isLoading) ? (
              <LoadingState />
            ) : typeCounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No materials yet.</p>
            ) : (
              <ul className="space-y-3">
                {typeCounts.map(({ type, count }) => (
                  <li key={type} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                      {TYPE_META[type].icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="font-medium text-slate-700">{TYPE_META[type].label}</span>
                        <span className="tabular-nums text-slate-500">{count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-red-700" style={{ width: `${(count / maxType) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      <SectionCard icon={icons.layers} title="Outline" meta={modules.length ? `${modules.length} ${modules.length === 1 ? 'module' : 'modules'}` : undefined}>
        {modulesQuery.isLoading && <LoadingState />}
        {modulesQuery.isError && <ErrorState message="Could not load modules. Refresh the page to try again." />}
        {!modulesQuery.isLoading && !modulesQuery.isError && modules.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-12 text-center">
            <span className="mb-2 text-slate-300">{icons.layers}</span>
            <p className="text-sm font-medium text-slate-700">No modules in this subject yet</p>
            {canManage && (
              <Button className="mt-4" onClick={() => onCreate({ kind: 'module', subjectId: subject.id })}>
                Add the first module
              </Button>
            )}
          </div>
        )}
        {modules.length > 0 && (
          <ol className="space-y-3">
            {modules.map((mod, i) => (
              <ModuleBlock
                key={mod.id}
                index={i}
                mod={mod}
                lessons={lessonsByModule.get(mod.id)}
                materialsByLesson={materialsByLesson}
                canManage={canManage}
                defaultOpen={i === 0}
                onCreate={onCreate}
              />
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}

// --- Page -------------------------------------------------------------------

export default function CurriculumPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('courses.update');

  const [programId, setProgramId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const subjects = subjectsQuery.data ?? [];
  const selectedSubject = subjects.find((s) => s.id === subjectId) ?? subjects[0];

  // Every level's module counts come from the same cache the workspace fills,
  // so the subject list can show them without a second round of requests.
  const moduleCounts = useQueries({
    queries: subjects.map((s) => ({
      queryKey: ['modules', s.id],
      queryFn: async (): Promise<ModuleRecord[]> => (await apiClient.get('/v1/modules', { params: { subjectId: s.id } })).data,
    })),
  });

  const openCreate = (t: CreateTarget) => {
    setCreateTarget(t);
    setDrawerOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Curriculum"
        description="Subjects, modules, lessons, and materials for each course. Every level moves from draft through review and approval before students see it."
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={createTarget ? CREATE_TITLES[createTarget.kind] : ''}>
        {createTarget?.kind === 'material' ? (
          <MaterialForm key={createTarget.lessonId} target={createTarget} onDone={() => setDrawerOpen(false)} />
        ) : createTarget ? (
          <NameForm key={JSON.stringify(createTarget)} target={createTarget} onDone={() => setDrawerOpen(false)} />
        ) : null}
      </Drawer>

      {programsQuery.isError && <ErrorState message="Could not load programs. Refresh the page to try again." />}
      {!effectiveProgramId && !programsQuery.isLoading && !programsQuery.isError && (
        <EmptyState title="No programs yet" description="Create a program on the Programs page first." />
      )}
      {effectiveProgramId && !effectiveCourseId && !coursesQuery.isLoading && (
        <EmptyState title="No courses in this program" description="Create a course on the Courses page first." />
      )}

      {effectiveCourseId && (
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <SectionCard
            icon={icons.book}
            title="Subjects"
            meta={subjects.length ? String(subjects.length) : undefined}
            className="self-start"
            action={
              canManage && (
                <button
                  type="button"
                  onClick={() => openCreate({ kind: 'subject', courseId: effectiveCourseId })}
                  aria-label="New subject"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                >
                  {icons.plus}
                </button>
              )
            }
          >
            {subjectsQuery.isLoading && <LoadingState />}
            {subjectsQuery.isError && <ErrorState message="Could not load subjects." />}
            {!subjectsQuery.isLoading && subjects.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-sm text-slate-600">No subjects yet.</p>
                {canManage && (
                  <Button className="mt-3" onClick={() => openCreate({ kind: 'subject', courseId: effectiveCourseId })}>
                    Add the first subject
                  </Button>
                )}
              </div>
            )}
            {subjects.length > 0 && (
              <ul className="-mx-2 space-y-0.5">
                {subjects.map((s, i) => {
                  const on = selectedSubject?.id === s.id;
                  const count = moduleCounts[i]?.data?.length;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSubjectId(s.id)}
                        aria-current={on ? 'true' : undefined}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                          on ? 'bg-red-50 font-medium text-red-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="min-w-0 truncate">{s.name}</span>
                        <span className={`shrink-0 text-xs tabular-nums ${on ? 'text-red-700' : 'text-slate-400'}`}>
                          {count === undefined ? '' : `${count} mod`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {selectedSubject ? (
            <SubjectWorkspace key={selectedSubject.id} subject={selectedSubject} canManage={canManage} onCreate={openCreate} />
          ) : (
            !subjectsQuery.isLoading && (
              <EmptyState title="Pick or add a subject" description="Subjects hold the modules, lessons, and materials for this course." />
            )
          )}
        </div>
      )}
    </div>
  );
}
