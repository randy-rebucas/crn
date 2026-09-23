'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
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
} from '@/components/ui';

interface Student {
  id: string;
  address: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; status: string };
}

// Loose but useful: accepts common PH formats like 09171234567 or +63 917 123 4567.
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

function generateTempPassword(length = 12) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => TEMP_PASSWORD_CHARS[n % TEMP_PASSWORD_CHARS.length]).join('');
}

const createStudentSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters'),
  phone: z.union([z.literal(''), z.string().regex(PHONE_REGEX, 'Enter a valid phone number')]).optional(),
});
type CreateStudentValues = z.infer<typeof createStudentSchema>;

function CreateStudentForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
        <div className="flex gap-2">
          <Input type={showPassword ? 'text' : 'password'} {...register('password')} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setValue('password', generateTempPassword(), { shouldValidate: true });
              setShowPassword(true);
            }}
          >
            Generate
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? 'Hide' : 'Show'}
          </Button>
        </div>
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input type="tel" placeholder="09XX XXX XXXX" {...register('phone')} />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create student'}
        </Button>
      </div>
    </form>
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

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New student">
        <CreateStudentForm
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['students'] });
          }}
        />
      </Drawer>

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
                    <Link href={`/students/${student.id}`} className="hover:underline">
                      {student.user.firstName} {student.user.lastName}
                    </Link>
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
