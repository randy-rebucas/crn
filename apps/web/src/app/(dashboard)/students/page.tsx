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
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
} from '@/components/ui';

interface Student {
  id: string;
  address: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; status: string };
}

const createStudentSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
  phone: z.string().optional(),
});
type CreateStudentValues = z.infer<typeof createStudentSchema>;

function CreateStudentForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentValues>({ resolver: zodResolver(createStudentSchema) });

  const onSubmit = async (values: CreateStudentValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/students', values);
      reset();
      onCreated();
    } catch (err) {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setServerError(message ?? 'Could not create student.');
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">New student</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="First name" error={errors.firstName?.message}>
          <Input {...register('firstName')} />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <Input {...register('lastName')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Temporary password" error={errors.password?.message}>
          <Input type="password" {...register('password')} />
        </Field>
        <Field label="Phone">
          <Input {...register('phone')} />
        </Field>
        <div className="flex items-end lg:col-span-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create student'}
          </Button>
        </div>
        {serverError && <p className="text-sm text-red-600 lg:col-span-4">{serverError}</p>}
      </form>
    </Card>
  );
}

export default function StudentsPage() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: async () => (await apiClient.get('/v1/students')).data,
  });

  return (
    <div>
      <PageHeader
        title="Students"
        description="Every enrolled and prospective student visible within your access scope."
        action={
          hasPermission('students.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Student'}</Button>
          )
        }
      />

      {showForm && (
        <div className="mb-6">
          <CreateStudentForm
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['students'] });
            }}
          />
        </div>
      )}

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load students." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No students visible" description="No students match your current access scope." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {student.user.firstName} {student.user.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{student.user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{student.user.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
