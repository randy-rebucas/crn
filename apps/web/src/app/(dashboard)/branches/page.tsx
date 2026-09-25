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
  PageHeader,
  Textarea,
} from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

interface BranchCounts {
  studentProfiles: number;
  instructorProfiles: number;
  staffProfiles: number;
  enrollments: number;
  rooms: number;
  classes: number;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive?: boolean;
  createdAt: string;
  _count?: BranchCounts;
}

interface RevenueSummary {
  totalInvoiced: number;
  byBranch: { branchId: string; invoiced: number }[];
}

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

// Amounts are stored in centavos.
function pesosCompact(cents: number) {
  return `₱${(cents / 100).toLocaleString('en-PH', { notation: 'compact', maximumFractionDigits: 1 })}`;
}

function share(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

const plusIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const STATS: { key: keyof BranchCounts; label: string; icon: React.ReactNode }[] = [
  { key: 'studentProfiles', label: 'Students', icon: adminIcons.users },
  { key: 'enrollments', label: 'Enrollments', icon: adminIcons.userPlus },
  { key: 'instructorProfiles', label: 'Instructors', icon: baseIcons.profile },
  { key: 'staffProfiles', label: 'Staff', icon: adminIcons.users },
  { key: 'classes', label: 'Classes', icon: adminIcons.grid },
  { key: 'rooms', label: 'Rooms', icon: adminIcons.mapPin },
];

// ---------------------------------------------------------------------------
// Create form

const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Give the branch a name'),
  code: z
    .string()
    .trim()
    .min(1, 'Give the branch a short code')
    .max(12, 'Keep the code to 12 characters or fewer')
    .regex(/^[A-Z0-9_-]+$/, 'Letters, numbers, dashes and underscores only'),
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

  const codeField = register('code', { setValueAs: (v: string) => v.toUpperCase() });

  const onSubmit = async (values: CreateBranchValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/branches', {
        name: values.name,
        code: values.code,
        address: values.address?.trim() || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create the branch. Check the details and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Name" error={errors.name?.message}>
          <Input {...register('name')} placeholder="Las Piñas Main" />
        </Field>
        <Field label="Code" error={errors.code?.message}>
          <Input
            {...codeField}
            placeholder="MAIN"
            autoCapitalize="characters"
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
              codeField.onChange(e);
            }}
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        The code is a short, unique label used on classes, rooms and reports. It can&apos;t be reused.
      </p>
      <Field label="Address">
        <Textarea {...register('address')} rows={3} placeholder="Building, street, barangay, city (optional)" />
      </Field>
      {serverError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create branch'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit

function EditBranchForm({ branch, onSaved }: { branch: Branch; onSaved: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [active, setActive] = useState(branch.isActive !== false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string; address: string }>({
    defaultValues: { name: branch.name, address: branch.address ?? '' },
  });

  const onSubmit = async (values: { name: string; address: string }) => {
    setServerError(null);
    try {
      await apiClient.patch(`/v1/branches/${branch.id}`, {
        name: values.name.trim(),
        address: values.address.trim() || null,
        isActive: active,
      });
      onSaved();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not save the branch.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Name" error={errors.name?.message}>
          <Input {...register('name', { validate: (v) => v.trim().length > 0 || 'Give the branch a name' })} />
        </Field>
        <Field label="Code">
          <Input value={branch.code} disabled readOnly />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-slate-500">The code can&apos;t change once it&apos;s in use on classes and reports.</p>
      <Field label="Address">
        <Textarea {...register('address')} rows={3} placeholder="Building, street, barangay, city (optional)" />
      </Field>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Branch is active</p>
          <p className="text-xs text-slate-500">
            Inactive branches are hidden from the public website&apos;s locations. Existing classes and records stay as they are.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label="Branch is active"
          onClick={() => setActive((v) => !v)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
            active ? 'bg-red-700' : 'bg-slate-300'
          }`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {serverError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Branch card

function BranchCard({
  branch,
  totalStudents,
  invoiced,
  totalInvoiced,
  onEdit,
}: {
  branch: Branch;
  totalStudents: number;
  invoiced: number | null;
  totalInvoiced: number;
  onEdit?: () => void;
}) {
  const counts = branch._count;
  const active = branch.isActive !== false;
  const students = counts?.studentProfiles ?? 0;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 p-5 pb-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5 ${
            active ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-500'
          }`}
          aria-hidden="true"
        >
          {adminIcons.mapPin}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-900">{branch.name}</h2>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
              {branch.code}
            </span>
          </div>
          <p className={`mt-1 text-sm ${branch.address ? 'text-slate-600' : 'italic text-slate-400'}`}>
            {branch.address ?? 'No address on file'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-600' : 'bg-slate-400'}`} />
          {active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {counts && (
        <dl className="grid grid-cols-3 gap-px border-y border-slate-100 bg-slate-100">
          {STATS.map((stat) => (
            <div key={stat.key} className="bg-white px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <span className="text-slate-400">{stat.icon}</span>
                {stat.label}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                {counts[stat.key].toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-auto space-y-3 p-5 pt-4">
        {counts && totalStudents > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Share of all students</span>
              <span className="font-medium tabular-nums text-slate-900">{share(students, totalStudents)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-red-700" style={{ width: `${share(students, totalStudents)}%` }} />
            </div>
          </div>
        )}
        {invoiced !== null && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Invoiced</span>
              <span className="font-medium tabular-nums text-slate-900">
                {pesosCompact(invoiced)}
                <span className="ml-1.5 text-slate-400">{share(invoiced, totalInvoiced)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${share(invoiced, totalInvoiced)}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Opened {new Date(branch.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${branch.name}`}
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function BranchesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canEdit = hasPermission('branches.create');
  const canReports = hasPermission('reports.view');

  const branchesQuery = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
  });

  // Same cache key as the Reports page, so revisiting either is instant.
  const revenueQuery = useQuery<RevenueSummary>({
    queryKey: ['reports', 'revenue'],
    queryFn: async () => (await apiClient.get('/v1/reports/revenue')).data,
    enabled: canReports,
  });

  const branches = branchesQuery.data ?? [];
  const totals = branches.reduce(
    (acc, b) => {
      if (!b._count) return acc;
      acc.students += b._count.studentProfiles;
      acc.instructors += b._count.instructorProfiles;
      acc.staff += b._count.staffProfiles;
      acc.rooms += b._count.rooms;
      return acc;
    },
    { students: 0, instructors: 0, staff: 0, rooms: 0 },
  );
  const hasCounts = branches.some((b) => b._count);
  const invoicedByBranch = new Map(revenueQuery.data?.byBranch.map((row) => [row.branchId, row.invoiced]));
  const activeCount = branches.filter((b) => b.isActive !== false).length;

  const summary = [
    { label: 'Branches', value: branches.length, detail: `${activeCount} active`, icon: adminIcons.mapPin, tone: 'bg-red-700 text-white' },
    { label: 'Students', value: totals.students, detail: 'across all branches', icon: adminIcons.users, tone: 'bg-amber-400 text-slate-900' },
    { label: 'Instructors & staff', value: totals.instructors + totals.staff, detail: `${totals.instructors} instructors · ${totals.staff} staff`, icon: baseIcons.profile, tone: 'bg-slate-900 text-white' },
    { label: 'Rooms', value: totals.rooms, detail: 'available for classes', icon: adminIcons.grid, tone: 'bg-amber-400 text-slate-900' },
  ];

  return (
    <div>
      <PageHeader
        title="Branches"
        description="The locations the review center operates from, and who and what each one holds."
        action={
          hasPermission('branches.create') && (
            <Button onClick={() => setShowForm(true)} className="inline-flex shrink-0 items-center gap-1.5">
              {plusIcon}
              New branch
            </Button>
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

      <Drawer open={editingId !== null} onClose={() => setEditingId(null)} title="Edit branch">
        {editingId && branchesQuery.data?.find((b) => b.id === editingId) && (
          <EditBranchForm
            key={editingId}
            branch={branchesQuery.data.find((b) => b.id === editingId)!}
            onSaved={() => {
              setEditingId(null);
              queryClient.invalidateQueries({ queryKey: ['branches'] });
            }}
          />
        )}
      </Drawer>

      {branchesQuery.isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}
      {branchesQuery.isError && <ErrorState message="Couldn't load branches. Refresh the page to try again." />}
      {branchesQuery.data && branches.length === 0 && (
        <EmptyState title="No branches yet" description="Add your first location to start assigning classes, rooms and staff." />
      )}

      {branches.length > 0 && (
        <div className="space-y-6">
          {hasCounts && (
            <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summary.map((s) => (
                <Card key={s.label} className="flex items-center gap-4 p-5">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.tone}`} aria-hidden="true">
                    {s.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{s.label}</p>
                    <p className="text-2xl font-semibold tabular-nums text-slate-900">{s.value.toLocaleString()}</p>
                    <p className="truncate text-xs text-slate-500">{s.detail}</p>
                  </div>
                </Card>
              ))}
            </section>
          )}

          <section aria-labelledby="locations-heading">
            <h2 id="locations-heading" className="mb-3 text-sm font-semibold text-slate-900">
              Locations
            </h2>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {branches.map((branch) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  totalStudents={totals.students}
                  invoiced={revenueQuery.data ? (invoicedByBranch.get(branch.id) ?? 0) : null}
                  totalInvoiced={revenueQuery.data?.totalInvoiced ?? 0}
                  onEdit={canEdit ? () => setEditingId(branch.id) : undefined}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
