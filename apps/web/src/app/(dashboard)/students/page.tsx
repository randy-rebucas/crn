'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { z } from 'zod';
import Link from 'next/link';
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
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';

interface Student {
  id: string;
  address: string | null;
  branchId: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone?: string | null; status: string };
}

interface Branch {
  id: string;
  name: string;
}

interface Enrollment {
  id: string;
  status: string;
  createdAt: string;
  student: { id: string };
  program: { name: string } | null;
}

type AccountStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'ARCHIVED';

const ACCOUNT_META: Record<AccountStatus, { label: string; dot: string }> = {
  ACTIVE: { label: 'Active', dot: '#059669' },
  INVITED: { label: 'Invited', dot: '#2563eb' },
  SUSPENDED: { label: 'Suspended', dot: '#d97706' },
  ARCHIVED: { label: 'Archived', dot: '#94a3b8' },
};

const BRANCH_COLORS = ['#b91c1c', '#f59e0b', '#2563eb', '#059669', '#7c3aed', '#475569'];

// Loose but useful: accepts common PH formats like 09171234567 or +63 917 123 4567.
const PHONE_REGEX = /^[+]?[\d\s().-]{7,20}$/;

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

function generateTempPassword(length = 12) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => TEMP_PASSWORD_CHARS[n % TEMP_PASSWORD_CHARS.length]).join('');
}

function initials(s: Student) {
  return `${s.user.firstName.charAt(0)}${s.user.lastName.charAt(0)}`.toUpperCase();
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const icons = {
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={8.5} cy={8} r={3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={16.5} cy={9.5} r={2.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3 20c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5M15 20c.6-2.4 2-4 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={12} r={8.2} stroke="currentColor" strokeWidth={1.7} />
      <path d="m8.5 12.3 2.4 2.4 4.6-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  userPlus: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={9.5} cy={8.5} r={3.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3.5 20c.9-3.4 3.6-5.3 6-5.3s5.1 1.9 6 5.3M18.5 8.5v5M16 11h5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  grad: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 5 9 4.5-9 4.5-9-4.5L12 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M7 11.8V16c1.3 1.3 3 2 5 2s3.7-.7 5-2v-4.2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <circle cx={12} cy={9.5} r={2.4} stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7l1.3-2 4 1.5v3A2 2 0 0 1 18 20.5 15.5 15.5 0 0 1 3.5 6 2 2 0 0 1 5.5 4Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
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
  chevronRight: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-slate-300" aria-hidden>
      <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
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

// --- Create form ------------------------------------------------------------

const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'Add a first name'),
  lastName: z.string().trim().min(1, 'Add a last name'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters'),
  phone: z.union([z.literal(''), z.string().regex(PHONE_REGEX, 'Enter a valid phone number')]).optional(),
  branchId: z.string().optional(),
});
type CreateStudentValues = z.infer<typeof createStudentSchema>;

function CreateStudentForm({
  branches,
  defaultBranchId,
  onCreated,
}: {
  branches: Branch[];
  defaultBranchId: string;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentValues>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', phone: '', branchId: defaultBranchId },
  });

  const onSubmit = async (values: CreateStudentValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/students', {
        ...values,
        phone: values.phone || undefined,
        branchId: values.branchId || undefined,
      });
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create the student. Check your connection and try again.'));
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(getValues('password'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowPassword(true);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Student</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message}>
            <Input autoComplete="off" {...register('firstName')} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input autoComplete="off" {...register('lastName')} />
          </Field>
        </div>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" placeholder="09XX XXX XXXX" {...register('phone')} />
        </Field>
        {branches.length > 0 && (
          <Field label="Branch">
            <Select {...register('branchId')}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">Branch staff only see students in their own branch.</p>
          </Field>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-slate-100 pt-5">
        <legend className="sr-only">Portal account</legend>
        <p className="-mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Portal account</p>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="off" {...register('email')} />
        </Field>
        <Field label="Temporary password" error={errors.password?.message}>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password')} />
            </div>
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
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Share it with the student; they can change it after signing in.</p>
            <button
              type="button"
              onClick={copyPassword}
              className="shrink-0 text-xs font-medium text-red-700 underline-offset-2 hover:underline"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </Field>
      </fieldset>

      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create student'}
        </Button>
      </div>
    </form>
  );
}

// --- Page -------------------------------------------------------------------

export default function StudentsPage() {
  const { user, hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountStatus>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const canBranches = hasPermission('branches.view');
  const canEnrollments = hasPermission('enrollments.view');

  const { data, isLoading, isError } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: async () => (await apiClient.get('/v1/students')).data,
  });
  const branchesQuery = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
    enabled: canBranches,
  });
  const enrollmentsQuery = useQuery<Enrollment[]>({
    queryKey: ['enrollments'],
    queryFn: async () => (await apiClient.get('/v1/enrollments')).data,
    enabled: canEnrollments,
  });

  const students = data ?? [];
  // Offer only the branches this staff member works in when they're
  // branch-bound; org-wide roles (no branch links) can place anyone anywhere.
  const allBranches = branchesQuery.data ?? [];
  const myBranches = user?.branchIds.length ? allBranches.filter((b) => user.branchIds.includes(b.id)) : allBranches;
  const formBranches = myBranches.length ? myBranches : allBranches;
  const branchName = new Map(allBranches.map((b) => [b.id, b.name]));
  const branchColor = new Map(allBranches.map((b, i) => [b.id, BRANCH_COLORS[i % BRANCH_COLORS.length]]));

  const latestEnrollment = new Map<string, Enrollment>();
  for (const e of enrollmentsQuery.data ?? []) {
    const prev = latestEnrollment.get(e.student.id);
    if (!prev || prev.createdAt < e.createdAt) latestEnrollment.set(e.student.id, e);
  }
  const enrolledNow = students.filter((s) => {
    const st = latestEnrollment.get(s.id)?.status;
    return st === 'ENROLLED';
  }).length;

  // Each student's most recent enrollment, folded into five plain buckets.
  const stageOf = (s: Student) => {
    const st = latestEnrollment.get(s.id)?.status;
    if (!st) return 'None';
    if (st === 'ENROLLED') return 'Enrolled';
    if (st === 'COMPLETED') return 'Completed';
    if (st === 'CANCELLED' || st === 'REJECTED') return 'Cancelled';
    return 'In progress';
  };
  const stageMix = [
    { label: 'Enrolled', color: '#b91c1c' },
    { label: 'Completed', color: '#059669' },
    { label: 'In progress', color: '#f59e0b' },
    { label: 'Cancelled', color: '#94a3b8' },
    { label: 'None', color: '#e2e8f0' },
  ]
    .map((s) => ({ ...s, count: students.filter((st) => stageOf(st) === s.label).length }))
    .filter((s) => s.count > 0);

  const now = new Date();
  const thisMonth = monthKey(now);
  const newThisMonth = students.filter((s) => monthKey(new Date(s.createdAt)) === thisMonth).length;
  const active = students.filter((s) => s.user.status === 'ACTIVE').length;

  // Last six calendar months, oldest first, zero-filled.
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (5 - i), 1));
  const growth = months.map((d) => {
    const key = monthKey(d);
    const row: Record<string, string | number> = { month: d.toLocaleDateString('en-US', { month: 'short' }) };
    for (const b of allBranches) row[b.id] = 0;
    row.none = 0;
    for (const s of students) {
      if (monthKey(new Date(s.createdAt)) !== key) continue;
      const k = s.branchId && branchName.has(s.branchId) ? s.branchId : 'none';
      row[k] = Number(row[k]) + 1;
    }
    return row;
  });
  const unassigned = students.filter((s) => !s.branchId).length;

  const byBranch = [
    ...allBranches.map((b) => ({ id: b.id, name: b.name, color: branchColor.get(b.id) ?? '#94a3b8', count: students.filter((s) => s.branchId === b.id).length })),
    ...(unassigned ? [{ id: 'none', name: 'No branch', color: '#cbd5e1', count: unassigned }] : []),
  ].filter((b) => b.count > 0);

  const q = search.trim().toLowerCase();
  const visible = students.filter((s) => {
    if (statusFilter !== 'ALL' && s.user.status !== statusFilter) return false;
    if (branchFilter === 'none' ? Boolean(s.branchId) : branchFilter !== 'ALL' && s.branchId !== branchFilter) return false;
    if (!q) return true;
    return `${s.user.firstName} ${s.user.lastName} ${s.user.email} ${s.user.phone ?? ''}`.toLowerCase().includes(q);
  });

  const statusChips = (['ALL', 'ACTIVE', 'INVITED', 'SUSPENDED', 'ARCHIVED'] as const)
    .map((k) => ({
      key: k,
      label: k === 'ALL' ? 'All' : ACCOUNT_META[k].label,
      count: k === 'ALL' ? students.length : students.filter((s) => s.user.status === k).length,
      dot: k === 'ALL' ? undefined : ACCOUNT_META[k].dot,
    }))
    .filter((c) => c.key === 'ALL' || c.count > 0);

  const defaultBranchId = formBranches[0]?.id ?? user?.branchIds[0] ?? '';

  return (
    <div>
      <PageHeader
        title="Students"
        description="Every enrolled and prospective student visible within your access scope."
        action={
          hasPermission('students.create') && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New student
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New student">
        <CreateStudentForm
          key={defaultBranchId}
          branches={formBranches}
          defaultBranchId={defaultBranchId}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['students'] });
          }}
        />
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load students. Refresh the page to try again." />}
      {!isLoading && !isError && students.length === 0 && (
        <EmptyState title="No students visible" description="No students match your current access scope." />
      )}

      {students.length > 0 && (
        <>
          <Card className="mb-6 grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-100">
            {[
              { icon: icons.users, label: 'Students', value: students.length },
              { icon: icons.check, label: 'Active accounts', value: active },
              { icon: icons.userPlus, label: 'Added this month', value: newThisMonth },
              ...(canEnrollments
                ? [{ icon: icons.grad, label: 'Currently enrolled', value: enrollmentsQuery.data ? enrolledNow : '…' }]
                : []),
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 p-4 sm:p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">{stat.icon}</span>
                <div className="min-w-0">
                  <div className="text-base font-semibold tabular-nums text-slate-900 sm:text-lg">{stat.value}</div>
                  <div className="text-xs leading-snug text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </Card>

          <div className="mb-6 grid gap-6 lg:grid-cols-5">
            <SectionCard icon={icons.barChart} title="New students" meta="Last 6 months" className="lg:col-span-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={growth} barCategoryGap="32%">
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                    formatter={(value, key) => [value, key === 'none' ? 'No branch' : (branchName.get(String(key)) ?? String(key))]}
                  />
                  {allBranches.map((b) => (
                    <Bar key={b.id} dataKey={b.id} stackId="s" fill={branchColor.get(b.id)} isAnimationActive={false} />
                  ))}
                  <Bar dataKey="none" stackId="s" fill="#cbd5e1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
              {allBranches.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">Branch breakdown needs permission to view branches.</p>
              )}
            </SectionCard>

            <SectionCard icon={icons.pin} title="Where they are" meta="By branch and enrollment" className="lg:col-span-2">
              {byBranch.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Branch details aren&apos;t available to you.</p>
              ) : (
                <ul className="space-y-3">
                  {byBranch.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setBranchFilter(branchFilter === b.id ? 'ALL' : b.id)}
                        aria-pressed={branchFilter === b.id}
                        className={`w-full rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                          branchFilter === b.id ? 'bg-slate-50' : ''
                        }`}
                      >
                        <div className="mb-1 flex items-baseline justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium text-slate-700">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                            {b.name}
                          </span>
                          <span className="tabular-nums text-slate-500">
                            <span className="font-semibold text-slate-900">{b.count}</span> · {Math.round((b.count / students.length) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${(b.count / students.length) * 100}%`, backgroundColor: b.color }} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {canEnrollments && enrollmentsQuery.data && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-medium text-slate-500">Latest enrollment</p>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    {stageMix.map((s) => (
                      <div key={s.label} title={`${s.label}: ${s.count}`} style={{ width: `${(s.count / students.length) * 100}%`, backgroundColor: s.color }} />
                    ))}
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    {stageMix.map((s) => (
                      <li key={s.label} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-900">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {unassigned > 0 && (
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-amber-700">
                  {unassigned} {unassigned === 1 ? 'student has' : 'students have'} no branch, so branch staff can&apos;t see them.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard
            icon={icons.users}
            title="All students"
            meta={visible.length !== students.length ? `${visible.length} of ${students.length}` : String(students.length)}
            action={
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search students</span>
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icons.search}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, phone"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
                />
              </label>
            }
          >
            <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter by account status">
              {statusChips.map((chip) => {
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
                    {chip.dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.dot }} />}
                    {chip.label}
                    <span className={`tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>{chip.count}</span>
                  </button>
                );
              })}
              {branchFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setBranchFilter('ALL')}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800 transition hover:bg-red-100"
                >
                  {branchFilter === 'none' ? 'No branch' : branchName.get(branchFilter)}
                  <span aria-hidden>×</span>
                  <span className="sr-only">Clear branch filter</span>
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No students match</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different search, or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('ALL');
                      setBranchFilter('ALL');
                    }}
                    className="font-medium text-red-700 underline-offset-2 hover:underline"
                  >
                    clear the filters
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                <ul className="-mx-5 divide-y divide-slate-100 border-t border-slate-100 md:hidden">
                  {visible.map((s) => {
                    const enr = latestEnrollment.get(s.id);
                    return (
                      <li key={s.id}>
                        <Link href={`/students/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {initials(s)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-slate-900">
                                {s.user.firstName} {s.user.lastName}
                              </span>
                              {s.user.status !== 'ACTIVE' && <StatusBadge status={s.user.status} />}
                            </div>
                            <div className="truncate text-xs text-slate-500">{s.user.email}</div>
                            {enr && (
                              <div className="mt-0.5 truncate text-xs text-slate-500">
                                {enr.program?.name ?? 'Enrollment'} · {enr.status.replace(/_/g, ' ').toLowerCase()}
                              </div>
                            )}
                          </div>
                          {icons.chevronRight}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="-mx-5 hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">Student</th>
                        <th className="px-5 py-2.5 font-medium">Branch</th>
                        {canEnrollments && <th className="px-5 py-2.5 font-medium">Latest enrollment</th>}
                        <th className="hidden px-5 py-2.5 font-medium xl:table-cell">Added</th>
                        <th className="px-5 py-2.5 font-medium">Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visible.map((s) => {
                        const enr = latestEnrollment.get(s.id);
                        return (
                          <tr key={s.id} className="group hover:bg-slate-50/70">
                            <td className="px-5 py-3">
                              <Link href={`/students/${s.id}`} className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                  {initials(s)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-slate-900 group-hover:text-red-700">
                                    {s.user.firstName} {s.user.lastName}
                                  </span>
                                  <span className="block truncate text-xs text-slate-500">{s.user.email}</span>
                                  {s.user.phone && (
                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                      {icons.phone}
                                      {s.user.phone}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </td>
                            <td className="px-5 py-3 text-xs">
                              {s.branchId && branchName.has(s.branchId) ? (
                                <span className="flex items-center gap-1.5 text-slate-700">
                                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: branchColor.get(s.branchId) }} />
                                  {branchName.get(s.branchId)}
                                </span>
                              ) : s.branchId ? (
                                <span className="text-slate-500">Assigned</span>
                              ) : (
                                <span className="text-amber-700">No branch</span>
                              )}
                            </td>
                            {canEnrollments && (
                              <td className="px-5 py-3">
                                {enr ? (
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-700">{enr.program?.name ?? '—'}</div>
                                    <StatusBadge status={enr.status} />
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">No enrollment</span>
                                )}
                              </td>
                            )}
                            <td className="hidden px-5 py-3 text-xs text-slate-500 xl:table-cell">{shortDate(s.createdAt)}</td>
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: ACCOUNT_META[s.user.status as AccountStatus]?.dot ?? '#94a3b8' }}
                                />
                                {ACCOUNT_META[s.user.status as AccountStatus]?.label ?? s.user.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
