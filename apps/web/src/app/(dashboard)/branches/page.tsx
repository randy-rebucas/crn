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
} from '@/components/ui';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  createdAt: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

const createBranchSchema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required'),
  address: z.string().optional(),
});
type CreateBranchValues = z.infer<typeof createBranchSchema>;

function CreateBranchForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBranchValues>({ resolver: zodResolver(createBranchSchema) });

  const onSubmit = async (values: CreateBranchValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/branches', {
        name: values.name,
        code: values.code,
        address: values.address || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create branch.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Name" error={errors.name?.message}>
        <Input {...register('name')} placeholder="Main Branch" />
      </Field>
      <Field label="Code" error={errors.code?.message}>
        <Input {...register('code')} placeholder="MAIN" />
      </Field>
      <Field label="Address">
        <Input {...register('address')} placeholder="Optional" />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create branch'}
        </Button>
      </div>
    </form>
  );
}

export default function BranchesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const branchesQuery = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
  });

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Physical locations the organization operates from."
        action={
          hasPermission('branches.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Branch'}</Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New branch">
        <CreateBranchForm
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['branches'] });
          }}
        />
      </Drawer>

      {branchesQuery.isLoading && <LoadingState />}
      {branchesQuery.isError && <ErrorState message="Could not load branches." />}
      {!branchesQuery.isLoading && !branchesQuery.isError && branchesQuery.data?.length === 0 && (
        <EmptyState title="No branches yet" description="Add a branch to get started." />
      )}

      {!branchesQuery.isLoading && branchesQuery.data && branchesQuery.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branchesQuery.data.map((branch) => (
            <Card key={branch.id} className="p-4">
              <p className="text-sm font-semibold text-slate-900">{branch.name}</p>
              <p className="text-xs text-slate-500">{branch.code}</p>
              {branch.address && <p className="mt-2 text-sm text-slate-600">{branch.address}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
