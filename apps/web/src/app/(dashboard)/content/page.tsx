'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
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
  MarkdownField,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';

type ContentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

// Mirrors ALLOWED_TRANSITIONS in apps/api/src/modules/content/content.service.ts
const NEXT_STATUSES: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'REVIEW'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

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
// Announcements
// ---------------------------------------------------------------------------

interface Announcement {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  createdAt: string;
}

const createAnnouncementSchema = z.object({ title: z.string().min(1, 'Required'), body: z.string().min(1, 'Required') });
type CreateAnnouncementValues = z.infer<typeof createAnnouncementSchema>;

function AnnouncementsTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const query = useQuery<Announcement[]>({
    queryKey: ['content', 'announcements'],
    queryFn: async () => (await apiClient.get('/v1/content/announcements')).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateAnnouncementValues>({ resolver: zodResolver(createAnnouncementSchema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      apiClient.patch(`/v1/content/announcements/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content', 'announcements'] }),
  });

  const onSubmit = async (values: CreateAnnouncementValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/content/announcements', values);
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['content', 'announcements'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create announcement.'));
    }
  };

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Announcement'}</Button>
        </div>
      )}
      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New Announcement">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Title" error={errors.title?.message}>
            <Input {...register('title')} />
          </Field>
          <Field label="Body" error={errors.body?.message}>
            <MarkdownField registration={register('body')} value={watch('body')} rows={5} />
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create announcement'}
            </Button>
          </div>
        </form>
      </Drawer>

      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message="Could not load announcements." />}
      {!query.isLoading && query.data?.length === 0 && (
        <EmptyState title="No announcements yet" description="Create the first announcement." />
      )}

      <div className="space-y-3">
        {query.data?.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                <div className="mt-1 space-y-1 text-sm text-slate-600 [&_a]:text-red-600 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                  <ReactMarkdown>{a.body}</ReactMarkdown>
                </div>
              </div>
              <StatusActions
                status={a.status}
                canManage={canManage}
                pending={transition.isPending}
                onTransition={(status) => transition.mutate({ id: a.id, status })}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success stories
// ---------------------------------------------------------------------------

interface SuccessStory {
  id: string;
  graduateName: string;
  programName: string;
  year: number | null;
  testimonial: string;
  status: ContentStatus;
}

const createStorySchema = z.object({
  graduateName: z.string().min(1, 'Required'),
  programName: z.string().min(1, 'Required'),
  year: z.string().optional(),
  testimonial: z.string().min(1, 'Required'),
});
type CreateStoryValues = z.infer<typeof createStorySchema>;

function SuccessStoriesTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const query = useQuery<SuccessStory[]>({
    queryKey: ['content', 'success-stories'],
    queryFn: async () => (await apiClient.get('/v1/content/success-stories')).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateStoryValues>({ resolver: zodResolver(createStorySchema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      apiClient.patch(`/v1/content/success-stories/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content', 'success-stories'] }),
  });

  const onSubmit = async (values: CreateStoryValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/content/success-stories', {
        ...values,
        year: values.year ? Number(values.year) : undefined,
      });
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['content', 'success-stories'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create success story.'));
    }
  };

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Success Story'}</Button>
        </div>
      )}
      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New Success Story">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Graduate name" error={errors.graduateName?.message}>
            <Input {...register('graduateName')} />
          </Field>
          <Field label="Program" error={errors.programName?.message}>
            <Input {...register('programName')} />
          </Field>
          <Field label="Year">
            <Input type="number" {...register('year')} />
          </Field>
          <Field label="Testimonial" error={errors.testimonial?.message}>
            <MarkdownField registration={register('testimonial')} value={watch('testimonial')} rows={5} />
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create success story'}
            </Button>
          </div>
        </form>
      </Drawer>

      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message="Could not load success stories." />}
      {!query.isLoading && query.data?.length === 0 && (
        <EmptyState title="No success stories yet" description="Add the first one." />
      )}

      <div className="space-y-3">
        {query.data?.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {s.graduateName} <span className="text-xs font-normal text-slate-500">· {s.programName} {s.year ?? ''}</span>
                </p>
                <div className="mt-1 space-y-1 text-sm text-slate-600 [&_a]:text-red-600 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                  <ReactMarkdown>{s.testimonial}</ReactMarkdown>
                </div>
              </div>
              <StatusActions
                status={s.status}
                canManage={canManage}
                pending={transition.isPending}
                onTransition={(status) => transition.mutate({ id: s.id, status })}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  status: ContentStatus;
}

const createFaqSchema = z.object({ question: z.string().min(1, 'Required'), answer: z.string().min(1, 'Required') });
type CreateFaqValues = z.infer<typeof createFaqSchema>;

function FaqTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const query = useQuery<FaqItem[]>({
    queryKey: ['content', 'faq'],
    queryFn: async () => (await apiClient.get('/v1/content/faq')).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateFaqValues>({ resolver: zodResolver(createFaqSchema) });
  const [serverError, setServerError] = useState<string | null>(null);

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContentStatus }) =>
      apiClient.patch(`/v1/content/faq/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content', 'faq'] }),
  });

  const onSubmit = async (values: CreateFaqValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/content/faq', values);
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['content', 'faq'] });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create FAQ item.'));
    }
  };

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New FAQ Item'}</Button>
        </div>
      )}
      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New FAQ Item">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Question" error={errors.question?.message}>
            <Input {...register('question')} />
          </Field>
          <Field label="Answer" error={errors.answer?.message}>
            <MarkdownField registration={register('answer')} value={watch('answer')} rows={5} />
          </Field>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create FAQ item'}
            </Button>
          </div>
        </form>
      </Drawer>

      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState message="Could not load FAQ items." />}
      {!query.isLoading && query.data?.length === 0 && <EmptyState title="No FAQ items yet" description="Add the first one." />}

      <div className="space-y-3">
        {query.data?.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{f.question}</p>
                <div className="mt-1 space-y-1 text-sm text-slate-600 [&_a]:text-red-600 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                  <ReactMarkdown>{f.answer}</ReactMarkdown>
                </div>
              </div>
              <StatusActions
                status={f.status}
                canManage={canManage}
                pending={transition.isPending}
                onTransition={(status) => transition.mutate({ id: f.id, status })}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'announcements' | 'success-stories' | 'faq';

export default function ContentPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>('announcements');
  const canManage = hasPermission('content.manage');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'announcements', label: 'Announcements' },
    { key: 'success-stories', label: 'Success Stories' },
    { key: 'faq', label: 'FAQ' },
  ];

  return (
    <div>
      <PageHeader
        title="Content"
        description="Public marketing content — announcements, success stories, and FAQ — through the same Draft → Review → Approved → Published → Archived pipeline as curriculum."
      />

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? 'border-b-2 border-red-700 text-red-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'announcements' && <AnnouncementsTab canManage={canManage} />}
      {tab === 'success-stories' && <SuccessStoriesTab canManage={canManage} />}
      {tab === 'faq' && <FaqTab canManage={canManage} />}
    </div>
  );
}
