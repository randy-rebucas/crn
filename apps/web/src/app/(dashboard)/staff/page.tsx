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
  Select,
  StatusBadge,
} from '@/components/ui';

interface StaffMember {
  id: string;
  position: string;
  department: string | null;
  hireDate: string | null;
  status: string;
  branchId: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null };
}

interface Branch {
  id: string;
  name: string;
}

interface OrgUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

const createStaffSchema = z.object({
  userId: z.string().min(1, 'Required'),
  branchId: z.string().optional(),
  position: z.string().min(1, 'Required'),
  department: z.string().optional(),
  hireDate: z.string().optional(),
});
type CreateStaffValues = z.infer<typeof createStaffSchema>;

function CreateStaffForm({
  users,
  branches,
  onCreated,
}: {
  users: OrgUser[];
  branches: Branch[];
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffValues>({ resolver: zodResolver(createStaffSchema) });

  const onSubmit = async (values: CreateStaffValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/staff', {
        userId: values.userId,
        branchId: values.branchId || undefined,
        position: values.position,
        department: values.department || undefined,
        hireDate: values.hireDate || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create staff member.'));
    }
  };

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">New staff member</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="User" error={errors.userId?.message}>
          <Select {...register('userId')}>
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.email})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Position" error={errors.position?.message}>
          <Input {...register('position')} placeholder="Registrar" />
        </Field>
        <Field label="Department">
          <Input {...register('department')} placeholder="Optional" />
        </Field>
        <Field label="Branch">
          <Select {...register('branchId')}>
            <option value="">Unassigned</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hire date">
          <Input type="date" {...register('hireDate')} />
        </Field>
        <div className="flex items-end lg:col-span-5">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Add staff member'}
          </Button>
        </div>
        {serverError && <p className="text-sm text-red-600 lg:col-span-5">{serverError}</p>}
      </form>
    </Card>
  );
}

export default function StaffPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const staffQuery = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => (await apiClient.get('/v1/staff')).data,
  });

  const branchesQuery = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
    enabled: showForm,
  });

  const usersQuery = useQuery<OrgUser[]>({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.get('/v1/users')).data,
    enabled: showForm,
  });

  const loadingLookups = branchesQuery.isLoading || usersQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Non-teaching personnel across the organization."
        action={
          hasPermission('staff.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Staff Member'}</Button>
          )
        }
      />

      {showForm && (
        <div className="mb-6">
          {loadingLookups && <LoadingState />}
          {!loadingLookups && (branchesQuery.isError || usersQuery.isError) && (
            <ErrorState message="Could not load users or branches." />
          )}
          {!loadingLookups && !branchesQuery.isError && !usersQuery.isError && (
            <CreateStaffForm
              users={usersQuery.data ?? []}
              branches={branchesQuery.data ?? []}
              onCreated={() => {
                setShowForm(false);
                queryClient.invalidateQueries({ queryKey: ['staff'] });
              }}
            />
          )}
        </div>
      )}

      {staffQuery.isLoading && <LoadingState />}
      {staffQuery.isError && <ErrorState message="Could not load staff." />}
      {!staffQuery.isLoading && !staffQuery.isError && staffQuery.data?.length === 0 && (
        <EmptyState title="No staff members yet" description="Add a staff member to get started." />
      )}

      {!staffQuery.isLoading && staffQuery.data && staffQuery.data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Hire date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffQuery.data.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {s.user.firstName} {s.user.lastName}
                    <div className="text-xs font-normal text-slate-400">{s.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.position}</td>
                  <td className="px-4 py-3 text-slate-600">{s.department ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.hireDate ? new Date(s.hireDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
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
