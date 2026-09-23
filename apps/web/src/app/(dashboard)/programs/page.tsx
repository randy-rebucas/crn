'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  PageHeader,
  StatusBadge,
  Textarea,
} from '@/components/ui';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface Program {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  courses: { id: string }[];
}

const createProgramSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z
    .string()
    .min(2, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
});
type CreateProgramValues = z.infer<typeof createProgramSchema>;

function useProgramActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['programs'] });

  const publish = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/programs/${id}/publish`),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/programs/${id}/archive`),
    onSuccess: invalidate,
  });

  return { publish, archive };
}

function CreateProgramForm({ onCreated }: { onCreated: () => void }) {
  const [slugTouched, setSlugTouched] = useState(false);
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>('write');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateProgramValues>({ resolver: zodResolver(createProgramSchema) });

  const { onChange: onSlugChange, ...slugField } = register('slug');
  const description = watch('description');

  const onSubmit = async (values: CreateProgramValues) => {
    await apiClient.post('/v1/programs', values);
    reset();
    setSlugTouched(false);
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Name" error={errors.name?.message}>
        <Input
          placeholder="Nursing Review"
          {...register('name', {
            onChange: (e) => {
              if (!slugTouched) setValue('slug', slugify(e.target.value), { shouldValidate: true });
            },
          })}
        />
      </Field>
      <Field label="Slug" error={errors.slug?.message}>
        <Input
          placeholder="nursing-review"
          {...slugField}
          onChange={(e) => {
            setSlugTouched(true);
            onSlugChange(e);
          }}
        />
      </Field>
      <Field label="Description">
        <div className="mb-1 flex gap-3 text-xs font-medium">
          <button
            type="button"
            onClick={() => setDescriptionTab('write')}
            className={descriptionTab === 'write' ? 'text-red-600' : 'text-slate-400'}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setDescriptionTab('preview')}
            className={descriptionTab === 'preview' ? 'text-red-600' : 'text-slate-400'}
          >
            Preview
          </button>
        </div>
        {descriptionTab === 'write' ? (
          <Textarea placeholder="Optional. Supports Markdown." rows={6} {...register('description')} />
        ) : (
          <div className="min-h-[132px] space-y-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 [&_a]:text-red-600 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
            {description ? (
              <ReactMarkdown>{description}</ReactMarkdown>
            ) : (
              <p className="text-slate-400">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create program'}
        </Button>
      </div>
    </form>
  );
}

export default function ProgramsPage() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });

  const { publish, archive } = useProgramActions();

  return (
    <div>
      <PageHeader
        title="Programs"
        description="Nursing, Midwifery, and every other review program offered."
        action={
          hasPermission('programs.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Program'}</Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New program">
        <CreateProgramForm
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load programs." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No programs yet" description="Create your first program to get started." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((program) => (
                <tr key={program.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{program.name}</div>
                    <div className="text-xs text-slate-500">{program.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{program.courses.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={program.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {hasPermission('programs.publish') && program.status !== 'PUBLISHED' && (
                      <Button
                        variant="ghost"
                        onClick={() => publish.mutate(program.id)}
                        disabled={publish.isPending}
                      >
                        Publish
                      </Button>
                    )}
                    {hasPermission('programs.archive') && program.status !== 'ARCHIVED' && (
                      <Button
                        variant="ghost"
                        onClick={() => archive.mutate(program.id)}
                        disabled={archive.isPending}
                      >
                        Archive
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
