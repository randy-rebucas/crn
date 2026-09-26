'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
} from '@/components/ui';

interface Enrollment {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  student: { id: string; user: { firstName: string; lastName: string; email: string } };
  program: { id: string; name: string };
  batch: { id: string; name: string } | null;
}

interface StudentOption {
  id: string;
  branchId: string | null;
  user: { firstName: string; lastName: string; email: string };
}
interface ProgramOption {
  id: string;
  name: string;
  status: string;
}
interface BatchOption {
  id: string;
  name: string;
  programId: string;
  branchId: string;
  status: string;
  startDate: string;
}

type Tone = 'primary' | 'secondary' | 'danger';

// Mirrors ENROLLMENT_TRANSITIONS in apps/api/src/modules/enrollments/enrollment-transitions.ts,
// with the verb each move means at the front desk. The API re-validates every
// move; this only decides which buttons to offer and how to word them.
const ACTIONS: Record<string, { to: string; label: string; tone: Tone; note?: string }[]> = {
  DRAFT: [
    { to: 'SUBMITTED', label: 'Submit application', tone: 'primary' },
    { to: 'CANCELLED', label: 'Cancel', tone: 'danger' },
  ],
  SUBMITTED: [
    { to: 'UNDER_REVIEW', label: 'Start review', tone: 'primary' },
    { to: 'CANCELLED', label: 'Cancel', tone: 'danger' },
  ],
  UNDER_REVIEW: [
    { to: 'APPROVED', label: 'Approve', tone: 'primary', note: 'Notifies the student' },
    { to: 'REQUIREMENTS_INCOMPLETE', label: 'Missing requirements', tone: 'secondary' },
    { to: 'REJECTED', label: 'Reject', tone: 'danger' },
  ],
  REQUIREMENTS_INCOMPLETE: [
    { to: 'UNDER_REVIEW', label: 'Back to review', tone: 'primary' },
    { to: 'CANCELLED', label: 'Cancel', tone: 'danger' },
  ],
  APPROVED: [{ to: 'PAYMENT_PENDING', label: 'Request payment', tone: 'primary' }],
  PAYMENT_PENDING: [
    { to: 'PAYMENT_VERIFIED', label: 'Mark payment verified', tone: 'primary', note: 'Needs a payment verified in Finance' },
    { to: 'CANCELLED', label: 'Cancel', tone: 'danger' },
  ],
  PAYMENT_VERIFIED: [{ to: 'ENROLLED', label: 'Enroll', tone: 'primary', note: 'Notifies the student and opens learning access' }],
  ENROLLED: [
    { to: 'COMPLETED', label: 'Mark completed', tone: 'secondary' },
    { to: 'CANCELLED', label: 'Cancel', tone: 'danger' },
  ],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

// Pipeline stages as the chart and filters present them. Each groups one or
// more API statuses; "Dropped" collects the two dead ends.
const STAGES = [
  { key: 'draft', label: 'Draft', statuses: ['DRAFT'], color: '#cbd5e1' },
  { key: 'applied', label: 'Applied', statuses: ['SUBMITTED'], color: '#93c5fd' },
  { key: 'review', label: 'In review', statuses: ['UNDER_REVIEW', 'REQUIREMENTS_INCOMPLETE'], color: '#2563eb' },
  { key: 'approved', label: 'Approved', statuses: ['APPROVED'], color: '#f59e0b' },
  { key: 'payment', label: 'Payment', statuses: ['PAYMENT_PENDING', 'PAYMENT_VERIFIED'], color: '#d97706' },
  { key: 'enrolled', label: 'Enrolled', statuses: ['ENROLLED'], color: '#b91c1c' },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'], color: '#059669' },
  { key: 'dropped', label: 'Dropped', statuses: ['CANCELLED', 'REJECTED'], color: '#94a3b8' },
] as const;
type StageKey = (typeof STAGES)[number]['key'];

// Statuses where the next move is on staff, not the student, with what that move is.
const WAITING_ON_STAFF: { status: string; action: string }[] = [
  { status: 'SUBMITTED', action: 'Start review' },
  { status: 'UNDER_REVIEW', action: 'Approve or reject' },
  { status: 'PAYMENT_PENDING', action: 'Check payment' },
  { status: 'PAYMENT_VERIFIED', action: 'Enroll' },
  { status: 'APPROVED', action: 'Request payment' },
];

function stageOf(status: string): StageKey {
  return (STAGES.find((s) => (s.statuses as readonly string[]).includes(status))?.key ?? 'draft') as StageKey;
}

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const icons = {
  userPlus: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={9.5} cy={8.5} r={3.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3.5 20c.9-3.4 3.6-5.3 6-5.3s5.1 1.9 6 5.3M18.5 8.5v5M16 11h5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 13.5 6.2 5.8A1.3 1.3 0 0 1 7.5 4.8h9a1.3 1.3 0 0 1 1.3 1l2.2 7.7V18a1.3 1.3 0 0 1-1.3 1.3H5.3A1.3 1.3 0 0 1 4 18v-4.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  grad: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 5 9 4.5-9 4.5-9-4.5L12 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M7 11.8V16c1.3 1.3 3 2 5 2s3.7-.7 5-2v-4.2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m4 16 5-5 4 4 7-7M15 8h5v5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  funnel: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 5h16l-6 7.5v5.5l-4 2v-7.5L4 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <circle cx={4.8} cy={6.5} r={1} fill="currentColor" />
      <circle cx={4.8} cy={12} r={1} fill="currentColor" />
      <circle cx={4.8} cy={17.5} r={1} fill="currentColor" />
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
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m5.5 12.5 4 4 9-9.5" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx={12} cy={12} r={8} stroke="currentColor" strokeWidth={1.8} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

// --- Row actions ------------------------------------------------------------

function EnrollmentActions({ enrollment }: { enrollment: Enrollment }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: (status: string) => apiClient.patch(`/v1/enrollments/${enrollment.id}/status`, { status }),
    onSuccess: () => {
      setError(null);
      setConfirming(null);
      return queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not update this enrollment. Try again.')),
  });

  const options = ACTIONS[enrollment.status] ?? [];
  if (options.length === 0) return <span className="block text-xs text-slate-400 lg:text-right">Final</span>;
  const pendingTo = move.isPending ? move.variables : null;
  const small = '!px-2.5 !py-1 text-xs';
  const primary = options.find((o) => o.tone === 'primary');
  const confirmOpt = options.find((o) => o.to === confirming);

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      {confirmOpt ? (
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          <span className="text-xs text-slate-600">
            {confirmOpt.to === 'REJECTED' ? 'Reject' : 'Cancel'} this enrollment? It can&apos;t be reopened.
          </span>
          <Button variant="danger" className={small} disabled={move.isPending} onClick={() => move.mutate(confirmOpt.to)}>
            {pendingTo === confirmOpt.to ? 'Saving…' : `Yes, ${confirmOpt.label.toLowerCase()}`}
          </Button>
          <Button variant="ghost" className={small} disabled={move.isPending} onClick={() => setConfirming(null)}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          {options.map((opt) => (
            <Button
              key={opt.to}
              variant={opt.tone === 'danger' ? 'ghost' : opt.tone}
              className={`${small} ${opt.tone === 'danger' ? '!text-red-700 hover:!bg-red-50' : ''}`}
              disabled={move.isPending}
              onClick={() => (opt.tone === 'danger' ? setConfirming(opt.to) : move.mutate(opt.to))}
            >
              {pendingTo === opt.to ? 'Saving…' : opt.label}
            </Button>
          ))}
        </div>
      )}
      {!confirmOpt && primary?.note && <p className="text-[11px] text-slate-400">{primary.note}</p>}
      {error && (
        <p role="alert" className="max-w-xs text-xs text-red-700 lg:text-right">
          {error}
        </p>
      )}
    </div>
  );
}

// --- Create form ------------------------------------------------------------

const createSchema = z.object({
  studentId: z.string().min(1, 'Choose a student'),
  programId: z.string().min(1, 'Choose a program'),
  batchId: z.string().optional(),
  branchId: z.string().min(1, 'Choose a branch'),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateEnrollmentForm({
  existing,
  onCreated,
}: {
  existing: Enrollment[];
  onCreated: () => void;
}) {
  const { user, hasPermission } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const canBranches = hasPermission('branches.view');
  // Without branches.view there's no branch picker, so fall back to the
  // staff member's own branch when they work in exactly one.
  const ownBranchId = user?.branchIds.length === 1 ? user.branchIds[0] : '';

  const studentsQuery = useQuery<StudentOption[]>({
    queryKey: ['students'],
    queryFn: async () => (await apiClient.get('/v1/students')).data,
  });
  const programsQuery = useQuery<ProgramOption[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });
  const batchesQuery = useQuery<BatchOption[]>({
    queryKey: ['batches'],
    queryFn: async () => (await apiClient.get('/v1/batches')).data,
    enabled: hasPermission('batches.view'),
  });
  const branchesQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
    enabled: canBranches,
  });
  const showBranchPicker = (branchesQuery.data ?? []).length > 0;

  const { register, handleSubmit, control, setValue, formState } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { studentId: '', programId: '', batchId: '', branchId: ownBranchId },
  });
  const [studentId, programId, branchId] = useWatch({ control, name: ['studentId', 'programId', 'branchId'] });

  const students = studentsQuery.data ?? [];
  const q = studentSearch.trim().toLowerCase();
  const studentMatches = students
    .filter((s) => !q || `${s.user.firstName} ${s.user.lastName} ${s.user.email}`.toLowerCase().includes(q))
    .slice(0, 50);
  const selectedStudent = students.find((s) => s.id === studentId);
  const programs = (programsQuery.data ?? []).filter((p) => p.status !== 'ARCHIVED');
  const batches = (batchesQuery.data ?? []).filter(
    (b) => b.programId === programId && (!branchId || b.branchId === branchId) && (b.status === 'UPCOMING' || b.status === 'ACTIVE'),
  );
  const openDuplicate = existing.find(
    (e) =>
      e.student.id === studentId &&
      e.program.id === programId &&
      !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(e.status),
  );

  const pickStudent = (id: string) => {
    const s = students.find((x) => x.id === id);
    setValue('studentId', id, { shouldValidate: true });
    setValue('branchId', s?.branchId || ownBranchId, { shouldValidate: true });
  };

  const onSubmit = async (values: CreateValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/enrollments', { ...values, batchId: values.batchId || undefined });
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create the enrollment. Try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Student" error={formState.errors.studentId?.message}>
        <input type="hidden" {...register('studentId')} />
        <input
          type="search"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          placeholder="Search by name or email"
          className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
        />
        <ul className="max-h-52 overflow-y-auto rounded-md border border-slate-200" role="listbox" aria-label="Students">
          {studentsQuery.isLoading && <li className="px-3 py-2 text-sm text-slate-500">Loading students…</li>}
          {!studentsQuery.isLoading && studentMatches.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No students match. Add them on the Students page first.</li>
          )}
          {studentMatches.map((s) => {
            const on = s.id === studentId;
            return (
              <li key={s.id} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => pickStudent(s.id)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                    on ? 'bg-red-50 text-red-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {s.user.firstName} {s.user.lastName}
                    </span>
                    <span className={`block truncate text-xs ${on ? 'text-red-700' : 'text-slate-500'}`}>{s.user.email}</span>
                  </span>
                  {on && <span className="shrink-0">{icons.check}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Field>

      <Field label="Program" error={formState.errors.programId?.message}>
        <Select
          {...register('programId', { onChange: () => setValue('batchId', '') })}
        >
          <option value="" disabled>
            Select program…
          </option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>

      {openDuplicate && (
        <p className="-mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {selectedStudent?.user.firstName} already has an open enrollment in this program (
          {openDuplicate.status.replace(/_/g, ' ').toLowerCase()}).
        </p>
      )}

      {!showBranchPicker && studentId && !branchId && (
        <p role="alert" className="-mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This student has no branch, and you can&apos;t pick one here. Ask someone with access to branches to assign the
          student a branch first.
        </p>
      )}

      {showBranchPicker && (
        <Field label="Branch" error={formState.errors.branchId?.message}>
          <Select {...register('branchId', { onChange: () => setValue('batchId', '') })}>
            <option value="" disabled>
              Select branch…
            </option>
            {(branchesQuery.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {selectedStudent?.branchId && <p className="mt-1 text-xs text-slate-500">Filled in from the student&apos;s branch.</p>}
        </Field>
      )}

      {hasPermission('batches.view') && (
        <Field label="Batch">
          <Select {...register('batchId')} disabled={!programId}>
            <option value="">{programId ? (batches.length ? 'Assign later' : 'No open batches for this program') : 'Choose a program first'}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · starts {shortDate(b.startDate)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <p className="text-xs text-slate-500">The enrollment starts as a draft. Submit it when the student&apos;s application is complete.</p>
      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Creating…' : 'Create enrollment'}
        </Button>
      </div>
    </form>
  );
}

// --- Page -------------------------------------------------------------------

export default function EnrollmentsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [stage, setStage] = useState<StageKey | 'ALL' | 'WAITING'>('ALL');
  const [programFilter, setProgramFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const canUpdate = hasPermission('enrollments.update');

  const { data, isLoading, isError } = useQuery<Enrollment[]>({
    queryKey: ['enrollments'],
    queryFn: async () => (await apiClient.get('/v1/enrollments')).data,
  });
  const enrollments = data ?? [];

  const waitingStatuses = new Set(WAITING_ON_STAFF.map((w) => w.status));
  const waiting = enrollments.filter((e) => waitingStatuses.has(e.status));
  const enrolled = enrollments.filter((e) => e.status === 'ENROLLED').length;
  const submitted = enrollments.filter((e) => e.status !== 'DRAFT');
  const converted = submitted.filter((e) => e.status === 'ENROLLED' || e.status === 'COMPLETED').length;
  const decided = submitted.filter((e) => ['ENROLLED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(e.status)).length;
  const conversion = decided ? Math.round((converted / decided) * 100) : null;

  const chartData = STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    count: enrollments.filter((e) => (s.statuses as readonly string[]).includes(e.status)).length,
    // Recharts reads a per-bar fill from the row; unselected stages fade.
    fill: stage === 'ALL' || stage === 'WAITING' || stage === s.key ? s.color : `${s.color}59`,
  }));

  const programs = [...new Map(enrollments.map((e) => [e.program.id, e.program.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const q = search.trim().toLowerCase();
  const visible = enrollments.filter((e) => {
    if (stage === 'WAITING' && !waitingStatuses.has(e.status)) return false;
    if (stage !== 'ALL' && stage !== 'WAITING' && stageOf(e.status) !== stage) return false;
    if (programFilter !== 'ALL' && e.program.id !== programFilter) return false;
    if (!q) return true;
    return `${e.student.user.firstName} ${e.student.user.lastName} ${e.student.user.email} ${e.program.name} ${e.batch?.name ?? ''}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Enrollments"
        description="Applications moving through the enrollment pipeline, scoped to your branch access."
        action={
          hasPermission('enrollments.create') && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New enrollment
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New enrollment">
        {showForm && (
          <CreateEnrollmentForm
            existing={enrollments}
            onCreated={() => {
              setShowForm(false);
              setStage('ALL');
              queryClient.invalidateQueries({ queryKey: ['enrollments'] });
            }}
          />
        )}
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load enrollments. Refresh the page to try again." />}
      {!isLoading && !isError && enrollments.length === 0 && (
        <EmptyState title="No enrollments visible" description="No enrollments match your current access scope." />
      )}

      {enrollments.length > 0 && (
        <>
          <Card className="mb-6 grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-100">
            {[
              { icon: icons.userPlus, label: 'Enrollments', value: enrollments.length, warn: false },
              { icon: icons.inbox, label: 'Waiting on staff', value: waiting.length, warn: waiting.length > 0 },
              { icon: icons.grad, label: 'Currently enrolled', value: enrolled, warn: false },
              {
                icon: icons.trend,
                label: 'Of decided applications, enrolled',
                value: conversion === null ? '—' : `${conversion}%`,
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
            <SectionCard icon={icons.funnel} title="Pipeline" meta="Select a stage to filter" className="lg:col-span-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} layout="vertical" barCategoryGap="24%" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" interval={0} width={76} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} formatter={(v) => [v, 'Enrollments']} />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const key = chartData[index].key;
                      setStage(stage === key ? 'ALL' : key);
                    }}
                   />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard
              icon={icons.inbox}
              title="Waiting on staff"
              meta={waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'enrollment' : 'enrollments'}` : undefined}
              className="lg:col-span-2"
            >
              {waiting.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {icons.check}
                  Nothing is waiting on staff right now.
                </div>
              ) : (
                <ul className="space-y-2">
                  {WAITING_ON_STAFF.map((w) => {
                    const count = enrollments.filter((e) => e.status === w.status).length;
                    if (count === 0) return null;
                    return (
                      <li key={w.status}>
                        <button
                          type="button"
                          onClick={() => {
                            setStage(stageOf(w.status));
                            setProgramFilter('ALL');
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                        >
                          <span className="min-w-0">
                            <StatusBadge status={w.status} />
                            <span className="mt-1 block text-xs text-slate-500">Next: {w.action}</span>
                          </span>
                          <span className="text-lg font-semibold tabular-nums text-slate-900">{count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>

          <SectionCard
            icon={icons.list}
            title="All enrollments"
            meta={visible.length !== enrollments.length ? `${visible.length} of ${enrollments.length}` : String(enrollments.length)}
            action={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {programs.length > 1 && (
                  <select
                    value={programFilter}
                    onChange={(e) => setProgramFilter(e.target.value)}
                    aria-label="Filter by program"
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
                  >
                    <option value="ALL">All programs</option>
                    {programs.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="relative block w-full sm:w-60">
                  <span className="sr-only">Search enrollments</span>
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icons.search}</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search student, program, batch"
                    className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
                  />
                </label>
              </div>
            }
          >
            <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter by stage">
              {[
                { key: 'ALL' as const, label: 'All', count: enrollments.length, color: undefined as string | undefined },
                ...(waiting.length ? [{ key: 'WAITING' as const, label: 'Waiting on staff', count: waiting.length, color: '#d97706' }] : []),
                ...chartData.filter((d) => d.count > 0).map((d) => ({ key: d.key, label: d.label, count: d.count, color: d.color })),
              ].map((chip) => {
                const on = stage === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStage(chip.key)}
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
                <p className="text-sm font-medium text-slate-700">No enrollments match</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different search, or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStage('ALL');
                      setProgramFilter('ALL');
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
                {visible.map((e) => {
                  const since = e.updatedAt ?? e.createdAt;
                  const stale = waitingStatuses.has(e.status) && daysSince(since) >= 7;
                  return (
                    <li key={e.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_19rem] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {e.student.user.firstName.charAt(0)}
                          {e.student.user.lastName.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/students/${e.student.id}`} className="block truncate font-medium text-slate-900 hover:text-red-700">
                            {e.student.user.firstName} {e.student.user.lastName}
                          </Link>
                          <div className="truncate text-xs text-slate-500">{e.student.user.email}</div>
                        </div>
                      </div>
                      <div className="min-w-0 pl-12 lg:pl-0">
                        <div className="truncate text-sm text-slate-800">{e.program.name}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <StatusBadge status={e.status} />
                          <span>{e.batch?.name ?? 'No batch yet'}</span>
                          <span className={`flex items-center gap-1 ${stale ? 'font-medium text-amber-700' : ''}`} title={`Last change ${shortDate(since)}`}>
                            {icons.clock}
                            {daysSince(since) === 0 ? 'today' : `${daysSince(since)}d in stage`}
                          </span>
                        </div>
                      </div>
                      <div className="pl-12 lg:pl-0">{canUpdate ? <EnrollmentActions enrollment={e} /> : null}</div>
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
