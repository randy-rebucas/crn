'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Fragment, useState } from 'react';
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

interface Lead {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  programInterest: string | null;
  source: string | null;
  status: string;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

interface FollowUp {
  id: string;
  note: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Mirrors the server's LEAD_TRANSITIONS map (apps/api/src/modules/leads/lead-transitions.ts)
// for UX only — the API re-validates every transition regardless.
const LEAD_TRANSITIONS: Record<string, string[]> = {
  LEAD: ['INQUIRY', 'LOST'],
  INQUIRY: ['APPLICATION', 'LOST'],
  APPLICATION: ['APPLICANT', 'LOST'],
  APPLICANT: ['ENROLLED', 'LOST'],
  ENROLLED: [],
  LOST: [],
};

const LEAD_STATUS_FILTERS = ['LEAD', 'INQUIRY', 'APPLICATION', 'APPLICANT', 'ENROLLED', 'LOST'] as const;

const LEAD_SOURCES = [
  'Walk-in',
  'Phone inquiry',
  'Website',
  'Facebook',
  'Referral',
  'School fair',
  'Advertisement',
  'Other',
] as const;

// Loose but useful: accepts common PH formats like 09171234567 or +63 917 123 4567.
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;

interface Program {
  id: string;
  name: string;
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

const createLeadSchema = z.object({
  fullName: z.string().min(1, 'Required'),
  email: z.union([z.literal(''), z.string().email('Enter a valid email address')]).optional(),
  phone: z.union([z.literal(''), z.string().regex(PHONE_REGEX, 'Enter a valid phone number')]).optional(),
  programInterest: z.string().optional(),
  source: z.string().optional(),
});
type CreateLeadValues = z.infer<typeof createLeadSchema>;

function CreateLeadForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { data: programs } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLeadValues>({ resolver: zodResolver(createLeadSchema) });

  const onSubmit = async (values: CreateLeadValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/leads', {
        fullName: values.fullName,
        email: values.email || undefined,
        phone: values.phone || undefined,
        programInterest: values.programInterest || undefined,
        source: values.source || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create lead.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Full name" error={errors.fullName?.message}>
        <Input {...register('fullName')} />
      </Field>
      <Field label="Email" error={errors.email?.message}>
        <Input type="email" {...register('email')} />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input type="tel" placeholder="09XX XXX XXXX" {...register('phone')} />
      </Field>
      <Field label="Program interest">
        <Input list="program-interest-options" placeholder="Start typing a program…" {...register('programInterest')} />
        <datalist id="program-interest-options">
          {(programs ?? []).map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Source">
        <Select {...register('source')}>
          <option value="">Select source…</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create lead'}
        </Button>
      </div>
    </form>
  );
}

function FollowUpForm({ leadId, onAdded }: { leadId: string; onAdded: () => void }) {
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/v1/leads/${leadId}/follow-ups`, { note, dueDate: dueDate || undefined });
      setNote('');
      setDueDate('');
      onAdded();
    } catch (err) {
      setError(errorMessage(err, 'Could not add follow-up.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[200px] flex-1">
        <Input placeholder="Follow-up note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-40" />
      <Button variant="secondary" onClick={submit} disabled={submitting}>
        {submitting ? 'Adding…' : 'Add follow-up'}
      </Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

function LeadDetail({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const { data: lead, isLoading } = useQuery<Lead & { followUps: FollowUp[] }>({
    queryKey: ['leads', leadId],
    queryFn: async () => (await apiClient.get(`/v1/leads/${leadId}`)).data,
  });

  if (isLoading || !lead) return <p className="text-sm text-slate-500">Loading follow-ups…</p>;

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-ups</div>
        {lead.followUps.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">No follow-ups recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {lead.followUps.map((f) => (
              <li key={f.id} className="text-sm text-slate-700">
                {f.note}
                {f.dueDate && (
                  <span className="ml-2 text-xs text-slate-400">due {new Date(f.dueDate).toLocaleDateString()}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <FollowUpForm
        leadId={leadId}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ['leads', leadId] })}
      />
    </div>
  );
}

export default function LeadsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<Lead[]>({
    queryKey: ['leads', 'list', statusFilter],
    queryFn: async () =>
      (await apiClient.get('/v1/leads', { params: statusFilter ? { status: statusFilter } : {} })).data,
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/v1/leads/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Inquiries moving through the admissions pipeline: Lead → Inquiry → Application → Applicant → Enrolled."
        action={
          hasPermission('leads.create') && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'New Lead'}</Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New lead">
        <CreateLeadForm
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['leads'] });
          }}
        />
      </Drawer>

      <div className="mb-4 w-56">
        <Field label="Filter by status">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {LEAD_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load leads." />}
      {!isLoading && !isError && data?.length === 0 && (
        <EmptyState title="No leads visible" description="No leads match the current filter." />
      )}

      {!isLoading && data && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Program interest</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Assigned to</th>
                <th className="px-4 py-3">Status</th>
                {hasPermission('leads.update') && <th className="px-4 py-3 text-right">Move to</th>}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((lead) => {
                const nextOptions = LEAD_TRANSITIONS[lead.status] ?? [];
                const expanded = expandedId === lead.id;
                return (
                  <Fragment key={lead.id}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-900">{lead.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{lead.email ?? '—'}</div>
                        <div className="text-xs text-slate-400">{lead.phone ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.programInterest ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.source ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      {hasPermission('leads.update') && (
                        <td className="px-4 py-3 text-right">
                          {nextOptions.length > 0 ? (
                            <Select
                              defaultValue=""
                              disabled={transition.isPending}
                              onChange={(e) => {
                                if (e.target.value) {
                                  transition.mutate({ id: lead.id, status: e.target.value });
                                }
                              }}
                            >
                              <option value="" disabled>
                                Choose status…
                              </option>
                              {nextOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-xs text-slate-400">Final</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" onClick={() => setExpandedId(expanded ? null : lead.id)}>
                          {expanded ? 'Hide' : 'Follow-ups'}
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50 px-4 py-3">
                          <LeadDetail leadId={lead.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
