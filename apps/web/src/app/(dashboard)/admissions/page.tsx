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

type AdmissionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

interface Admission {
  id: string;
  status: AdmissionStatus;
  notes: string | null;
  createdAt: string;
  lead: { id: string; fullName: string; email: string | null; phone: string | null };
  program: { id: string; name: string } | null;
}

interface Lead {
  id: string;
  fullName: string;
  status: string;
}

interface Program {
  id: string;
  name: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

// Mirrors ALLOWED_TRANSITIONS in apps/api/src/modules/admissions/admissions.service.ts
const ADMISSION_ACTIONS: Record<AdmissionStatus, { action: 'start-review' | 'approve' | 'reject'; label: string }[]> = {
  SUBMITTED: [
    { action: 'start-review', label: 'Start review' },
    { action: 'approve', label: 'Approve' },
    { action: 'reject', label: 'Reject' },
  ],
  UNDER_REVIEW: [
    { action: 'approve', label: 'Approve' },
    { action: 'reject', label: 'Reject' },
  ],
  APPROVED: [],
  REJECTED: [],
};

const STATUS_FILTERS: AdmissionStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

const createAdmissionSchema = z.object({
  leadId: z.string().min(1, 'Required'),
  programId: z.string().optional(),
  notes: z.string().optional(),
});
type CreateAdmissionValues = z.infer<typeof createAdmissionSchema>;

function CreateAdmissionForm({
  leads,
  programs,
  onCreated,
}: {
  leads: Lead[];
  programs: Program[];
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAdmissionValues>({ resolver: zodResolver(createAdmissionSchema) });

  const applicationLeads = leads.filter((l) => l.status === 'APPLICATION');

  const onSubmit = async (values: CreateAdmissionValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/admissions', {
        leadId: values.leadId,
        programId: values.programId || undefined,
        notes: values.notes || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not start admission review.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Lead (Application stage)" error={errors.leadId?.message}>
        <Select {...register('leadId')}>
          <option value="">Select a lead…</option>
          {applicationLeads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.fullName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Program">
        <Select {...register('programId')}>
          <option value="">Unspecified</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes">
        <Input {...register('notes')} placeholder="Optional" />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create admission'}
        </Button>
      </div>
    </form>
  );
}

export default function AdmissionsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const admissionsQuery = useQuery<Admission[]>({
    queryKey: ['admissions', 'list', statusFilter],
    queryFn: async () =>
      (await apiClient.get('/v1/admissions', { params: statusFilter ? { status: statusFilter } : {} })).data,
  });

  const leadsQuery = useQuery<Lead[]>({
    queryKey: ['leads', 'list', ''],
    queryFn: async () => (await apiClient.get('/v1/leads')).data,
    enabled: showForm,
  });

  const programsQuery = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
    enabled: showForm,
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start-review' | 'approve' | 'reject' }) =>
      apiClient.patch(`/v1/admissions/${id}/${action}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admissions'] }),
  });

  const canReview = hasPermission('admissions.review');
  const loadingLookups = leadsQuery.isLoading || programsQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Applications moving through review: Submitted → Under Review → Approved/Rejected."
        action={
          hasPermission('admissions.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Admission'}</Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New admission">
        {loadingLookups && <LoadingState />}
        {!loadingLookups && (leadsQuery.isError || programsQuery.isError) && (
          <ErrorState message="Could not load leads or programs." />
        )}
        {!loadingLookups && !leadsQuery.isError && !programsQuery.isError && (
          <CreateAdmissionForm
            leads={leadsQuery.data ?? []}
            programs={programsQuery.data ?? []}
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['admissions'] });
            }}
          />
        )}
      </Drawer>

      <div className="mb-4 w-56">
        <Field label="Filter by status">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {admissionsQuery.isLoading && <LoadingState />}
      {admissionsQuery.isError && <ErrorState message="Could not load admissions." />}
      {!admissionsQuery.isLoading && !admissionsQuery.isError && admissionsQuery.data?.length === 0 && (
        <EmptyState title="No admissions visible" description="No admissions match the current filter." />
      )}

      {!admissionsQuery.isLoading && admissionsQuery.data && admissionsQuery.data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                {canReview && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admissionsQuery.data.map((admission) => {
                const actions = ADMISSION_ACTIONS[admission.status];
                return (
                  <tr key={admission.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {admission.lead.fullName}
                      <div className="text-xs font-normal text-slate-400">{admission.lead.email ?? admission.lead.phone ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{admission.program?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={admission.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{admission.notes ?? '—'}</td>
                    {canReview && (
                      <td className="px-4 py-3 text-right">
                        {actions.length > 0 ? (
                          <div className="flex justify-end gap-1.5">
                            {actions.map((a) => (
                              <Button
                                key={a.action}
                                variant={a.action === 'reject' ? 'danger' : 'secondary'}
                                disabled={review.isPending}
                                onClick={() => review.mutate({ id: admission.id, action: a.action })}
                              >
                                {a.label}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Final</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
