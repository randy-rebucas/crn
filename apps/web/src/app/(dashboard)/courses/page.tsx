'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Textarea,
} from '@/components/ui';

interface Program {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  description: string | null;
  programId: string;
}

const createCourseSchema = z.object({
  programId: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required'),
  description: z.string().optional(),
});
type CreateCourseValues = z.infer<typeof createCourseSchema>;

function CreateCourseForm({ programs, onCreated }: { programs: Program[]; onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCourseValues>({ resolver: zodResolver(createCourseSchema) });

  const onSubmit = async (values: CreateCourseValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/courses', values);
      reset();
      onCreated();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setServerError(message ?? 'Could not create course.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Program" error={errors.programId?.message}>
        <Select {...register('programId')} defaultValue="">
          <option value="" disabled>
            Select program…
          </option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <Input placeholder="Fundamentals of Nursing" {...register('name')} />
      </Field>
      <Field label="Code" error={errors.code?.message}>
        <Input placeholder="NUR-101" {...register('code')} />
      </Field>
      <Field label="Description">
        <Textarea placeholder="Optional" rows={4} {...register('description')} />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create course'}
        </Button>
      </div>
    </form>
  );
}

export default function CoursesPage() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [programFilter, setProgramFilter] = useState('');
  const queryClient = useQueryClient();

  const { data: programs, isLoading: programsLoading } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });

  const effectiveProgramId = programFilter || programs?.[0]?.id || '';

  const { data, isLoading, isError } = useQuery<Course[]>({
    queryKey: ['courses', effectiveProgramId],
    queryFn: async () => (await apiClient.get('/v1/courses', { params: { programId: effectiveProgramId } })).data,
    enabled: Boolean(effectiveProgramId),
  });

  const programsById = new Map((programs ?? []).map((p) => [p.id, p.name]));

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Courses grouped under each program, scoped to your access."
        action={
          hasPermission('courses.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Course'}</Button>
          )
        }
      />

      <div className="mb-4 max-w-xs">
        <Field label="Program">
          <Select value={effectiveProgramId} onChange={(e) => setProgramFilter(e.target.value)} disabled={programsLoading}>
            {(programs ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New course">
        <CreateCourseForm
          programs={programs ?? []}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['courses'] });
          }}
        />
      </Drawer>

      {!effectiveProgramId && !programsLoading && (
        <EmptyState title="No programs yet" description="Create a program first to manage its courses." />
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load courses." />}
      {!isLoading && !isError && effectiveProgramId && data?.length === 0 && (
        <EmptyState title="No courses yet" description="Create the first course for this program." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((course) => (
                <tr key={course.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{course.name}</td>
                  <td className="px-4 py-3 text-slate-600">{course.code}</td>
                  <td className="px-4 py-3 text-slate-600">{programsById.get(course.programId) ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{course.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
