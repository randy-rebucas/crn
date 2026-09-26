'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
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
  Input,
  LoadingState,
  MarkdownField,
  PageHeader,
  StatusBadge,
} from '@/components/ui';

type ProgramStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

interface Program {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProgramStatus;
  courses: { id: string }[];
}

interface Batch {
  id: string;
  programId: string;
  name: string;
  startDate: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

interface Enrollment {
  id: string;
  status: string;
  program: { id: string } | null;
}

interface PricingRow {
  id: string;
  programId: string;
  amount: number;
  currency: string;
  isActive: boolean;
}

// Where an enrollment sits, collapsed from the API's eleven statuses into
// the three questions this page answers: studying, still in the pipeline,
// or dropped out of it.
const ENROLLED = new Set(['ENROLLED', 'COMPLETED']);
const DROPPED = new Set(['CANCELLED', 'REJECTED']);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pesos(amount: number, currency: string) {
  const value = amount / 100;
  return currency === 'PHP'
    ? `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
    : `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const icons = {
  grad: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 5 9 4.5-9 4.5-9-4.5L12 5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M7 11.8V16c1.3 1.3 3 2 5 2s3.7-.7 5-2v-4.2M21 9.5V14" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M4 6.5C4 5.7 4.7 5 6 5h5v14H6c-1.3 0-2-.7-2-1.5v-11ZM20 6.5c0-.8-.7-1.5-2-1.5h-5v14h5c1.3 0 2-.7 2-1.5v-11Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x={4} y={5.5} width={16} height={15} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M4 9.5h16M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={8.5} cy={8} r={3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={16.5} cy={9.5} r={2.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3 20c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5M15 20c.6-2.4 2-4 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M3.5 12.3V4.8a1.3 1.3 0 0 1 1.3-1.3h7.5l8.2 8.2a1.3 1.3 0 0 1 0 1.8l-6.7 6.7a1.3 1.3 0 0 1-1.8 0l-8.5-7.9Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <circle cx={8.3} cy={8.3} r={1.4} fill="currentColor" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
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
  alert: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M12 4 21 19.5H3L12 4Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={12} cy={16.8} r={0.9} fill="currentColor" />
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

const createProgramSchema = z.object({
  name: z.string().trim().min(2, 'Give the program a name'),
  slug: z
    .string()
    .min(2, 'Add a slug')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
});
type CreateProgramValues = z.infer<typeof createProgramSchema>;

function CreateProgramForm({ existingSlugs, onCreated }: { existingSlugs: Set<string>; onCreated: () => void }) {
  const [slugTouched, setSlugTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateProgramValues>({
    resolver: zodResolver(createProgramSchema),
    defaultValues: { name: '', slug: '', description: '' },
  });

  const { onChange: onSlugChange, ...slugField } = register('slug');
  const [slug, description] = useWatch({ control, name: ['slug', 'description'] });
  const slugTaken = Boolean(slug) && existingSlugs.has(slug);

  const onSubmit = async (values: CreateProgramValues) => {
    setServerError(null);
    if (existingSlugs.has(values.slug)) {
      setError('slug', { message: 'Another program already uses this slug' });
      return;
    }
    try {
      await apiClient.post('/v1/programs', { ...values, description: values.description?.trim() || undefined });
      onCreated();
    } catch (err) {
      // The API doesn't translate its unique-slug constraint into a 409, so a
      // race with another admin surfaces as a generic failure — say so plainly.
      setServerError(errorMessage(err, 'Could not create the program. The slug may already be in use — try another.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Name" error={errors.name?.message}>
        <Input
          placeholder="e.g. Nursing Board Review"
          {...register('name', {
            onChange: (e) => {
              if (!slugTouched) setValue('slug', slugify(e.target.value), { shouldValidate: true });
            },
          })}
        />
      </Field>
      <Field label="Slug" error={errors.slug?.message}>
        <Input
          placeholder="nursing-board-review"
          {...slugField}
          onChange={(e) => {
            setSlugTouched(true);
            onSlugChange(e);
          }}
        />
        {slugTaken && !errors.slug ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
            {icons.alert}
            Another program already uses this slug.
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Used in links to the program{slug ? <> — <span className="font-medium text-slate-700">/programs/{slug}</span></> : ''}.
          </p>
        )}
      </Field>
      <Field label="Description">
        <MarkdownField
          registration={register('description')}
          value={description}
          rows={6}
          placeholder="Optional. Who it's for, what it covers, how long it runs. Supports Markdown."
        />
      </Field>
      <p className="text-xs text-slate-500">New programs start as drafts and stay off the public site until published.</p>
      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || slugTaken}>
          {isSubmitting ? 'Creating…' : 'Create program'}
        </Button>
      </div>
    </form>
  );
}

// --- Row actions ------------------------------------------------------------

function ProgramActions({ program }: { program: Program }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: (action: 'publish' | 'archive') => apiClient.patch(`/v1/programs/${program.id}/${action}`),
    onSuccess: () => {
      setError(null);
      setConfirmArchive(false);
      return queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not update the program. Try again.')),
  });

  const canPublish = hasPermission('programs.publish') && program.status !== 'PUBLISHED';
  const canArchive = hasPermission('programs.archive') && program.status !== 'ARCHIVED';
  if (!canPublish && !canArchive) return null;
  const pending = change.isPending ? change.variables : null;

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {confirmArchive ? (
          <>
            <span className="self-center text-xs text-slate-600">Takes it off the public site.</span>
            <Button variant="danger" disabled={change.isPending} onClick={() => change.mutate('archive')}>
              {pending === 'archive' ? 'Archiving…' : 'Archive'}
            </Button>
            <Button variant="ghost" disabled={change.isPending} onClick={() => setConfirmArchive(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {canPublish && (
              <Button disabled={change.isPending} onClick={() => change.mutate('publish')}>
                {pending === 'publish' ? 'Publishing…' : program.status === 'ARCHIVED' ? 'Republish' : 'Publish'}
              </Button>
            )}
            {canArchive && (
              <Button variant="secondary" disabled={change.isPending} onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            )}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// --- Page -------------------------------------------------------------------

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

export default function ProgramsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const canBatches = hasPermission('batches.view');
  const canEnrollments = hasPermission('enrollments.view');
  const canPricing = hasPermission('pricing.view');

  const { data, isLoading, isError } = useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => (await apiClient.get('/v1/programs')).data,
  });
  const batchesQuery = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: async () => (await apiClient.get('/v1/batches')).data,
    enabled: canBatches,
  });
  const enrollmentsQuery = useQuery<Enrollment[]>({
    queryKey: ['enrollments'],
    queryFn: async () => (await apiClient.get('/v1/enrollments')).data,
    enabled: canEnrollments,
  });
  const pricingQuery = useQuery<PricingRow[]>({
    queryKey: ['pricing'],
    queryFn: async () => (await apiClient.get('/v1/pricing')).data,
    enabled: canPricing,
  });

  const programs = data ?? [];
  const batchesByProgram = new Map<string, Batch[]>();
  for (const b of batchesQuery.data ?? []) batchesByProgram.set(b.programId, [...(batchesByProgram.get(b.programId) ?? []), b]);

  const enrollmentMix = new Map<string, { enrolled: number; pipeline: number; dropped: number }>();
  for (const e of enrollmentsQuery.data ?? []) {
    if (!e.program) continue;
    const row = enrollmentMix.get(e.program.id) ?? { enrolled: 0, pipeline: 0, dropped: 0 };
    if (ENROLLED.has(e.status)) row.enrolled += 1;
    else if (DROPPED.has(e.status)) row.dropped += 1;
    else row.pipeline += 1;
    enrollmentMix.set(e.program.id, row);
  }

  const activePrice = new Map<string, PricingRow>();
  for (const p of pricingQuery.data ?? []) if (p.isActive && !activePrice.has(p.programId)) activePrice.set(p.programId, p);

  const counts = {
    PUBLISHED: programs.filter((p) => p.status === 'PUBLISHED').length,
    ARCHIVED: programs.filter((p) => p.status === 'ARCHIVED').length,
  };
  const drafts = programs.length - counts.PUBLISHED - counts.ARCHIVED;
  const totalCourses = programs.reduce((sum, p) => sum + p.courses.length, 0);
  const openBatches = (batchesQuery.data ?? []).filter((b) => b.status === 'UPCOMING' || b.status === 'ACTIVE').length;
  const totalEnrolled = [...enrollmentMix.values()].reduce((sum, r) => sum + r.enrolled, 0);

  const q = search.trim().toLowerCase();
  const visible = programs.filter((p) => {
    if (filter === 'PUBLISHED' && p.status !== 'PUBLISHED') return false;
    if (filter === 'ARCHIVED' && p.status !== 'ARCHIVED') return false;
    if (filter === 'DRAFT' && (p.status === 'PUBLISHED' || p.status === 'ARCHIVED')) return false;
    return !q || `${p.name} ${p.slug} ${p.description ?? ''}`.toLowerCase().includes(q);
  });

  const chartData = programs
    .map((p) => ({
      name: p.name.length > 24 ? `${p.name.slice(0, 23)}…` : p.name,
      fullName: p.name,
      ...(enrollmentMix.get(p.id) ?? { enrolled: 0, pipeline: 0, dropped: 0 }),
    }))
    .sort((a, b) => b.enrolled + b.pipeline - (a.enrolled + a.pipeline));

  const chips: { key: StatusFilter; label: string; count: number; dot?: string }[] = [
    { key: 'ALL', label: 'All', count: programs.length },
    { key: 'PUBLISHED', label: 'Published', count: counts.PUBLISHED, dot: '#059669' },
    { key: 'DRAFT', label: 'Not published', count: drafts, dot: '#94a3b8' },
    { key: 'ARCHIVED', label: 'Archived', count: counts.ARCHIVED, dot: '#cbd5e1' },
  ];

  const existingSlugs = new Set(programs.map((p) => p.slug));

  return (
    <div>
      <PageHeader
        title="Programs"
        description="Nursing, Midwifery, and every other review program offered."
        action={
          hasPermission('programs.create') && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New program
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New program">
        <CreateProgramForm
          existingSlugs={existingSlugs}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['programs'] });
          }}
        />
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load programs. Refresh the page to try again." />}
      {!isLoading && !isError && programs.length === 0 && (
        <EmptyState title="No programs yet" description="Create your first program, then add its courses and batches." />
      )}

      {programs.length > 0 && (
        <>
          <Card className="mb-6 grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-100">
            <div className="col-span-2 p-4 sm:p-5 lg:col-span-1">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">{icons.grad}</span>
                <div>
                  <div className="text-base font-semibold tabular-nums text-slate-900 sm:text-lg">
                    {counts.PUBLISHED}
                    <span className="text-sm font-normal text-slate-400"> of {programs.length}</span>
                  </div>
                  <div className="text-xs text-slate-500">Programs published</div>
                </div>
              </div>
              <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="bg-emerald-600" style={{ width: `${(counts.PUBLISHED / programs.length) * 100}%` }} />
                <div className="bg-slate-400" style={{ width: `${(drafts / programs.length) * 100}%` }} />
              </div>
            </div>
            {[
              { icon: icons.book, label: 'Courses', value: totalCourses },
              ...(canBatches ? [{ icon: icons.calendar, label: 'Upcoming or active batches', value: batchesQuery.data ? openBatches : '…' }] : []),
              ...(canEnrollments ? [{ icon: icons.users, label: 'Students enrolled', value: enrollmentsQuery.data ? totalEnrolled : '…' }] : []),
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

          {canEnrollments && (
            <SectionCard icon={icons.barChart} title="Enrollment by program" meta="Every application, by where it stands" className="mb-6">
              {enrollmentsQuery.isLoading ? (
                <LoadingState />
              ) : enrollmentsQuery.isError ? (
                <ErrorState message="Could not load enrollments for the chart." />
              ) : (enrollmentsQuery.data ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No enrollments yet.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(150, chartData.length * 40 + 30)}>
                    <BarChart data={chartData} layout="vertical" barCategoryGap="30%" margin={{ left: 0, right: 12 }}>
                      <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                        formatter={(value, key) => [value, key === 'enrolled' ? 'Enrolled' : key === 'pipeline' ? 'In the pipeline' : 'Cancelled or rejected']}
                      />
                      <Bar dataKey="enrolled" stackId="e" fill="#b91c1c" isAnimationActive={false} />
                      <Bar dataKey="pipeline" stackId="e" fill="#f59e0b" isAnimationActive={false} />
                      <Bar dataKey="dropped" stackId="e" fill="#cbd5e1" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {[
                      ['bg-red-700', 'Enrolled or completed'],
                      ['bg-amber-500', 'In the pipeline'],
                      ['bg-slate-300', 'Cancelled or rejected'],
                    ].map(([color, label]) => (
                      <span key={label} className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          )}

          <SectionCard
            icon={icons.grad}
            title="All programs"
            meta={visible.length !== programs.length ? `${visible.length} of ${programs.length}` : String(programs.length)}
            action={
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search programs</span>
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icons.search}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search programs"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
                />
              </label>
            }
          >
            <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter by status">
              {chips.map((chip) => {
                const on = filter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(chip.key)}
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
            </div>

            {visible.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No programs match</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different search, or{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilter('ALL');
                    }}
                    className="font-medium text-red-700 underline-offset-2 hover:underline"
                  >
                    show all programs
                  </button>
                  .
                </p>
              </div>
            ) : (
              <ul className="-mx-5 divide-y divide-slate-100 border-t border-slate-100">
                {visible.map((program) => {
                  const batches = (batchesByProgram.get(program.id) ?? []).slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
                  const nextBatch = batches.find((b) => b.status === 'UPCOMING' || b.status === 'ACTIVE');
                  const mix = enrollmentMix.get(program.id);
                  const price = activePrice.get(program.id);
                  return (
                    <li key={program.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{program.name}</h3>
                          <StatusBadge status={program.status} />
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          {icons.link}/programs/{program.slug}
                        </p>
                        {program.description ? (
                          <div className="mt-2 line-clamp-3 max-w-prose space-y-1 text-sm leading-relaxed text-slate-600 [&_a]:text-red-700 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                            <ReactMarkdown>{program.description}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-400">No description yet.</p>
                        )}

                        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <dt className="text-slate-400">{icons.book}</dt>
                            <dd>
                              <span className="font-semibold tabular-nums text-slate-900">{program.courses.length}</span>{' '}
                              {program.courses.length === 1 ? 'course' : 'courses'}
                            </dd>
                          </div>
                          {canBatches && (
                            <div className="flex items-center gap-1.5">
                              <dt className="text-slate-400">{icons.calendar}</dt>
                              <dd>
                                {nextBatch ? (
                                  <>
                                    {nextBatch.status === 'ACTIVE' ? 'Running: ' : 'Upcoming: '}
                                    <span className="font-medium text-slate-900">{nextBatch.name}</span>
                                    <span className="text-slate-400"> · {shortDate(nextBatch.startDate)}</span>
                                  </>
                                ) : batches.length > 0 ? (
                                  `${batches.length} past ${batches.length === 1 ? 'batch' : 'batches'}`
                                ) : (
                                  <span className="text-amber-700">No batches scheduled</span>
                                )}
                              </dd>
                            </div>
                          )}
                          {canEnrollments && (
                            <div className="flex items-center gap-1.5">
                              <dt className="text-slate-400">{icons.users}</dt>
                              <dd>
                                <span className="font-semibold tabular-nums text-slate-900">{mix?.enrolled ?? 0}</span> enrolled
                                {mix && mix.pipeline > 0 && <span className="text-slate-400"> · {mix.pipeline} in progress</span>}
                              </dd>
                            </div>
                          )}
                          {canPricing && (
                            <div className="flex items-center gap-1.5">
                              <dt className="text-slate-400">{icons.tag}</dt>
                              <dd>
                                {price ? (
                                  <span className="font-semibold tabular-nums text-slate-900">{pesos(price.amount, price.currency)}</span>
                                ) : (
                                  <span className="text-amber-700">No active price</span>
                                )}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                      <ProgramActions program={program} />
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
