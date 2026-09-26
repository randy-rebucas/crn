'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from '@/components/ui';

type AdmissionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
type ReviewAction = 'start-review' | 'approve' | 'reject';

interface Admission {
  id: string;
  status: AdmissionStatus;
  notes: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  lead: { id: string; fullName: string; email: string | null; phone: string | null };
  program: { id: string; name: string } | null;
}

interface Lead {
  id: string;
  fullName: string;
  status: string;
  email?: string | null;
  phone?: string | null;
  programInterest?: string | null;
}

interface Program {
  id: string;
  name: string;
}

const STATUS_META: Record<AdmissionStatus, { label: string; color: string }> = {
  SUBMITTED: { label: 'Submitted', color: '#93c5fd' },
  UNDER_REVIEW: { label: 'Under review', color: '#2563eb' },
  APPROVED: { label: 'Approved', color: '#059669' },
  REJECTED: { label: 'Rejected', color: '#b91c1c' },
};
const STATUSES: AdmissionStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

// Mirrors ALLOWED_TRANSITIONS in apps/api/src/modules/admissions/admissions.service.ts.
// Approve and reject also move the linked lead (to Applicant / Lost), so they
// open a short confirm-with-note step rather than firing on one click.
const ACTIONS: Record<AdmissionStatus, { action: ReviewAction; label: string }[]> = {
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

function daysBetween(from: string, to: Date | string = new Date()) {
  const end = typeof to === 'string' ? new Date(to) : to;
  return Math.max(0, Math.floor((end.getTime() - new Date(from).getTime()) / 86_400_000));
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

const icons = {
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x={5.5} y={4.5} width={13} height={16} rx={1.6} stroke="currentColor" strokeWidth={1.7} />
      <path d="M9 4.2h6a1 1 0 0 1 1 1v1.3H8V5.2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="m9 13.2 2 2 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  hourglass: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M7 3.5h10M7 20.5h10M8 3.5v3.2c0 1.6 1 3 2.5 3.8L12 11.3l1.5-.8C15 9.7 16 8.3 16 6.7V3.5M8 20.5v-3.2c0-1.6 1-3 2.5-3.8l1.5-.8 1.5.8c1.5.8 2.5 2.2 2.5 3.8v3.2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={12} r={8.2} stroke="currentColor" strokeWidth={1.7} />
      <path d="m8.5 12.3 2.4 2.4 4.6-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={12} r={8} stroke="currentColor" strokeWidth={1.7} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 13.5 6.2 5.8A1.3 1.3 0 0 1 7.5 4.8h9a1.3 1.3 0 0 1 1.3 1l2.2 7.7V18a1.3 1.3 0 0 1-1.3 1.3H5.3A1.3 1.3 0 0 1 4 18v-4.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <rect x={3.5} y={5.5} width={17} height={13} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3A2 2 0 0 1 18 20.5 15.5 15.5 0 0 1 3.5 6 2 2 0 0 1 5.5 4Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M5 4.5h14v10.5l-4.5 4.5H5V4.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M14.5 19.5V15H19M8.5 9h7M8.5 12h4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={11} cy={11} r={6.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ),
};

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

// --- Row review actions -----------------------------------------------------

function ReviewActions({ admission }: { admission: Admission }) {
  const queryClient = useQueryClient();
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: ({ action, notes }: { action: ReviewAction; notes?: string }) =>
      apiClient.patch(`/v1/admissions/${admission.id}/${action}`, notes ? { notes } : {}),
    onSuccess: () => {
      setError(null);
      setDeciding(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      return queryClient.invalidateQueries({ queryKey: ['admissions'] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not update this admission. Try again.')),
  });

  const actions = ACTIONS[admission.status];
  if (actions.length === 0) {
    return (
      <span className="block text-xs text-slate-400 lg:text-right">
        {admission.reviewedAt ? `Decided ${shortDate(admission.reviewedAt)}` : 'Final'}
      </span>
    );
  }
  const small = '!px-2.5 !py-1 text-xs';

  if (deciding) {
    const approving = deciding === 'approve';
    return (
      <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 lg:w-80">
        <p className="text-xs font-medium text-slate-800">
          {approving ? `Approve ${admission.lead.fullName}?` : `Reject ${admission.lead.fullName}?`}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {approving ? 'Their lead moves to Applicant, ready to enroll.' : 'Their lead is marked Lost. This can’t be undone.'}
        </p>
        <label className="mt-2 block">
          <span className="sr-only">{approving ? 'Note (optional)' : 'Reason'}</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={approving ? 'Note (optional)' : 'Reason — helps if they reapply'}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
          />
        </label>
        {admission.notes && note.trim() && (
          <p className="mt-1 text-[11px] text-slate-500">This replaces the existing note.</p>
        )}
        <div className="mt-2 flex justify-end gap-1.5">
          <Button variant="ghost" className={small} disabled={review.isPending} onClick={() => setDeciding(null)}>
            Back
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            className={small}
            disabled={review.isPending}
            onClick={() => review.mutate({ action: deciding, notes: note.trim() || undefined })}
          >
            {review.isPending ? 'Saving…' : approving ? 'Approve' : 'Reject'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-1.5 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <div className="flex flex-wrap gap-1.5 lg:justify-end">
        {actions.map((a) => (
          <Button
            key={a.action}
            variant={a.action === 'approve' ? 'primary' : a.action === 'reject' ? 'ghost' : 'secondary'}
            className={`${small} ${a.action === 'reject' ? '!text-red-700 hover:!bg-red-50' : ''}`}
            disabled={review.isPending}
            onClick={() => (a.action === 'start-review' ? review.mutate({ action: a.action }) : setDeciding(a.action))}
          >
            {review.isPending && review.variables?.action === a.action ? 'Saving…' : a.label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-red-700 lg:text-right">
          {error}
        </p>
      )}
    </div>
  );
}

// --- Create form ------------------------------------------------------------

const createAdmissionSchema = z.object({
  leadId: z.string().min(1, 'Choose a lead'),
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateAdmissionValues>({
    resolver: zodResolver(createAdmissionSchema),
    defaultValues: { leadId: '', programId: '', notes: '' },
  });

  const onSubmit = async (values: CreateAdmissionValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/admissions', {
        leadId: values.leadId,
        programId: values.programId || undefined,
        notes: values.notes?.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not start the admission review. Try again.'));
    }
  };

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
        <p className="text-sm font-medium text-slate-700">No leads are ready for admission</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
          A lead needs to reach the Application stage, and not already have an admission, before review can start.
        </p>
        <Link href="/leads" className="mt-3 inline-block text-sm font-medium text-red-700 underline-offset-2 hover:underline">
          Go to Leads
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Applicant" error={errors.leadId?.message}>
        <Select
          {...register('leadId', {
            onChange: (e) => {
              // Pre-pick the program the lead said they were interested in, when it matches one.
              const lead = leads.find((l) => l.id === e.target.value);
              const match = programs.find((p) => lead?.programInterest && p.name.toLowerCase() === lead.programInterest.toLowerCase());
              if (match) setValue('programId', match.id);
            },
          })}
        >
          <option value="" disabled>
            Select a lead…
          </option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.fullName}
              {lead.programInterest ? ` — interested in ${lead.programInterest}` : ''}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-500">Only leads at the Application stage without an admission are listed.</p>
      </Field>
      <Field label="Program">
        <Select {...register('programId')}>
          <option value="">Not decided yet</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea {...register('notes')} rows={4} placeholder="Optional — documents received, interview notes, anything the reviewer should know" />
      </Field>
      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Start admission review'}
        </Button>
      </div>
    </form>
  );
}

// --- Page -------------------------------------------------------------------

export default function AdmissionsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | AdmissionStatus>('ALL');
  const [search, setSearch] = useState('');

  const canReview = hasPermission('admissions.review');

  // One unfiltered fetch; status filtering happens here so counts, the chart,
  // and the queue all read from the same list.
  const admissionsQuery = useQuery<Admission[]>({
    queryKey: ['admissions', 'list', ''],
    queryFn: async () => (await apiClient.get('/v1/admissions')).data,
  });
  const leadsQuery = useQuery<Lead[]>({
    queryKey: ['leads', 'list', ''],
    queryFn: async () => (await apiClient.get('/v1/leads')).data,
    enabled: showForm,
  });
  // Optional here (the program can be decided later), so skip it rather
  // than fail the whole form when the viewer lacks programs.view.
  const canPrograms = hasPermission('programs.view');
  const programsQuery = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
    enabled: showForm && canPrograms,
  });

  const admissions = admissionsQuery.data ?? [];
  const pending = admissions.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW');
  const approved = admissions.filter((a) => a.status === 'APPROVED');
  const rejected = admissions.filter((a) => a.status === 'REJECTED');
  const decided = [...approved, ...rejected];
  const approvalRate = decided.length ? Math.round((approved.length / decided.length) * 100) : null;
  const decisionDays = decided.filter((a) => a.reviewedAt).map((a) => daysBetween(a.createdAt, a.reviewedAt!));
  const avgDecision = decisionDays.length ? Math.round(decisionDays.reduce((s, d) => s + d, 0) / decisionDays.length) : null;

  const queue = [...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const byProgram = new Map<string, { name: string; SUBMITTED: number; UNDER_REVIEW: number; APPROVED: number; REJECTED: number }>();
  for (const a of admissions) {
    const key = a.program?.id ?? 'none';
    const row = byProgram.get(key) ?? { name: a.program?.name ?? 'Undecided', SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
    row[a.status] += 1;
    byProgram.set(key, row);
  }
  const chartData = [...byProgram.values()]
    .map((r) => ({ ...r, short: r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name }))
    .sort((a, b) => b.SUBMITTED + b.UNDER_REVIEW + b.APPROVED + b.REJECTED - (a.SUBMITTED + a.UNDER_REVIEW + a.APPROVED + a.REJECTED));

  const admittedLeadIds = new Set(admissions.map((a) => a.lead.id));
  const eligibleLeads = (leadsQuery.data ?? []).filter((l) => l.status === 'APPLICATION' && !admittedLeadIds.has(l.id));

  const q = search.trim().toLowerCase();
  const visible = admissions.filter((a) => {
    if (statusFilter === 'PENDING' && !(a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW')) return false;
    if (statusFilter !== 'ALL' && statusFilter !== 'PENDING' && a.status !== statusFilter) return false;
    if (!q) return true;
    return `${a.lead.fullName} ${a.lead.email ?? ''} ${a.lead.phone ?? ''} ${a.program?.name ?? ''} ${a.notes ?? ''}`.toLowerCase().includes(q);
  });

  const chips = [
    { key: 'ALL' as const, label: 'All', count: admissions.length, color: undefined as string | undefined },
    { key: 'PENDING' as const, label: 'Awaiting decision', count: pending.length, color: '#d97706' },
    ...STATUSES.map((s) => ({ key: s, label: STATUS_META[s].label, count: admissions.filter((a) => a.status === s).length, color: STATUS_META[s].color })),
  ].filter((c) => c.key === 'ALL' || c.count > 0);

  const loadingLookups = leadsQuery.isLoading || (canPrograms && programsQuery.isLoading);

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Applications moving through review: Submitted → Under Review → Approved/Rejected."
        action={
          hasPermission('admissions.create') && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New admission
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Start an admission review">
        {loadingLookups && <LoadingState />}
        {!loadingLookups && leadsQuery.isError && (
          <ErrorState message="Could not load leads. Close this panel and try again." />
        )}
        {showForm && !loadingLookups && !leadsQuery.isError && (
          <CreateAdmissionForm
            leads={eligibleLeads}
            programs={programsQuery.data ?? []}
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['admissions'] });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
            }}
          />
        )}
      </Drawer>

      {admissionsQuery.isLoading && <LoadingState />}
      {admissionsQuery.isError && <ErrorState message="Could not load admissions. Refresh the page to try again." />}
      {!admissionsQuery.isLoading && !admissionsQuery.isError && admissions.length === 0 && (
        <EmptyState title="No admissions yet" description="Start a review for a lead that has reached the Application stage." />
      )}

      {admissions.length > 0 && (
        <>
          <Card className="mb-6 grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-100">
            {[
              { icon: icons.clipboard, label: 'Admissions', value: admissions.length, warn: false },
              { icon: icons.hourglass, label: 'Awaiting a decision', value: pending.length, warn: pending.length > 0 },
              { icon: icons.check, label: 'Approval rate', value: approvalRate === null ? '—' : `${approvalRate}%`, warn: false },
              {
                icon: icons.clock,
                label: 'Average days to decide',
                value: avgDecision === null ? '—' : `${avgDecision} ${avgDecision === 1 ? 'day' : 'days'}`,
                warn: false,
              },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 p-4 sm:p-5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    stat.warn ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stat.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-base font-semibold tabular-nums text-slate-900 sm:text-lg">{stat.value}</div>
                  <div className="text-xs leading-snug text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </Card>

          <div className="mb-6 grid gap-6 lg:grid-cols-5">
            <SectionCard icon={icons.barChart} title="Decisions by program" className="lg:col-span-3">
              <ResponsiveContainer width="100%" height={Math.max(150, chartData.length * 40 + 30)}>
                <BarChart data={chartData} layout="vertical" barCategoryGap="30%" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="short" width={150} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                    formatter={(value, key) => [value, STATUS_META[key as AdmissionStatus]?.label ?? String(key)]}
                  />
                  {STATUSES.map((s, i) => (
                    <Bar
                      key={s}
                      dataKey={s}
                      stackId="a"
                      fill={STATUS_META[s].color}
                      radius={i === STATUSES.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {STATUSES.map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_META[s].color }} />
                    {STATUS_META[s].label}
                  </span>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              icon={icons.inbox}
              title="Review queue"
              meta={queue.length ? 'Longest waiting first' : undefined}
              className="lg:col-span-2"
            >
              {queue.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {icons.check}
                  Every application has a decision.
                </div>
              ) : (
                <ol className="space-y-2">
                  {queue.slice(0, 5).map((a) => {
                    const waited = daysBetween(a.createdAt);
                    return (
                      <li key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {initials(a.lead.fullName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{a.lead.fullName}</div>
                          <div className="truncate text-xs text-slate-500">
                            {a.program?.name ?? 'Program undecided'} · {STATUS_META[a.status].label.toLowerCase()}
                          </div>
                        </div>
                        <span className={`shrink-0 text-xs font-medium tabular-nums ${waited >= 7 ? 'text-amber-700' : 'text-slate-500'}`}>
                          {waited === 0 ? 'today' : `${waited}d`}
                        </span>
                      </li>
                    );
                  })}
                  {queue.length > 5 && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('PENDING')}
                        className="px-1 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                      >
                        See all {queue.length} waiting
                      </button>
                    </li>
                  )}
                </ol>
              )}
            </SectionCard>
          </div>

          <SectionCard
            icon={icons.clipboard}
            title="All admissions"
            meta={visible.length !== admissions.length ? `${visible.length} of ${admissions.length}` : String(admissions.length)}
            action={
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search admissions</span>
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icons.search}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, contact, program"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
                />
              </label>
            }
          >
            <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter by status">
              {chips.map((chip) => {
                const on = statusFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatusFilter(chip.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {chip.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />}
                    {chip.label}
                    <span className={`tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>{chip.count}</span>
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No admissions match</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different search, or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('ALL');
                    }}
                    className="font-medium text-red-700 underline-offset-2 hover:underline"
                  >
                    clear the filters
                  </button>
                  .
                </p>
              </div>
            ) : (
              <ul className="-mx-5 divide-y divide-slate-100 border-t border-slate-100">
                {visible.map((a) => {
                  const waited = daysBetween(a.createdAt);
                  const open = a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW';
                  return (
                    <li key={a.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem] lg:items-start">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {initials(a.lead.fullName)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{a.lead.fullName}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            {a.lead.email && (
                              <a href={`mailto:${a.lead.email}`} className="flex min-w-0 items-center gap-1 hover:text-red-700">
                                {icons.mail}
                                <span className="truncate">{a.lead.email}</span>
                              </a>
                            )}
                            {a.lead.phone && (
                              <a href={`tel:${a.lead.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 hover:text-red-700">
                                {icons.phone}
                                {a.lead.phone}
                              </a>
                            )}
                            {!a.lead.email && !a.lead.phone && <span>No contact details</span>}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 pl-12 lg:pl-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-800">{a.program?.name ?? 'Program undecided'}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <div className={`mt-0.5 text-xs ${open && waited >= 7 ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
                          Submitted {shortDate(a.createdAt)}
                          {open && ` · waiting ${waited === 0 ? 'since today' : `${waited}d`}`}
                        </div>
                        {a.notes && (
                          <p className="mt-1.5 flex max-w-prose gap-1.5 text-xs text-slate-600">
                            <span className="mt-0.5 text-slate-400">{icons.note}</span>
                            <span className="line-clamp-2">{a.notes}</span>
                          </p>
                        )}
                      </div>
                      <div className="pl-12 lg:pl-0">{canReview ? <ReviewActions admission={a} /> : null}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
