'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
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
  Select,
  StatusBadge,
} from '@/components/ui';
import { icons as baseIcons } from '@/components/student-ui';
import { adminIcons } from '@/components/admin-shell';

const STAFF_STATUSES = ['ACTIVE', 'ON_LEAVE', 'ARCHIVED'] as const;
type StaffStatus = (typeof STAFF_STATUSES)[number];

interface StaffMember {
  id: string;
  position: string;
  department: string | null;
  hireDate: string | null;
  status: StaffStatus;
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

type StatusFilter = 'all' | StaffStatus;

function errorMessage(err: unknown, fallback: string) {
  return (isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) ?? fallback;
}

function humanize(value: string) {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function tenure(hireDate: string) {
  const start = new Date(hireDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return 'New this month';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}

// Stable per-person tint so the same staff member keeps the same avatar color.
const AVATAR_TONES = ['bg-red-700 text-white', 'bg-amber-400 text-slate-900', 'bg-slate-900 text-white', 'bg-red-100 text-red-800', 'bg-amber-100 text-amber-900'];
function avatarTone(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function Avatar({ member }: { member: StaffMember }) {
  const initials = `${member.user.firstName.charAt(0)}${member.user.lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(member.id)}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

const plusIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const pencilIcon = (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="m14.5 5.5 4 4M4 20l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19 4 20Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
  </svg>
);

function DrawerSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

// ---------------------------------------------------------------------------
// Create

const createStaffSchema = z.object({
  userId: z.string().min(1, 'Choose the user account for this person'),
  branchId: z.string().optional(),
  position: z.string().trim().min(1, 'Enter their position'),
  department: z.string().optional(),
  hireDate: z.string().optional(),
});
type CreateStaffValues = z.infer<typeof createStaffSchema>;

function CreateStaffForm({
  users,
  branches,
  departments,
  onCreated,
}: {
  users: OrgUser[];
  branches: Branch[];
  departments: string[];
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
        department: values.department?.trim() || undefined,
        hireDate: values.hireDate || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not add this staff member. Check the details and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <fieldset className="space-y-4">
        <legend className="sr-only">Person</legend>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Person</p>
        <Field label="User account" error={errors.userId?.message}>
          <Select {...register('userId')} disabled={users.length === 0}>
            <option value="">{users.length === 0 ? 'Every user already has a staff record' : 'Select a user…'}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.email})
              </option>
            ))}
          </Select>
        </Field>
        <p className="-mt-2 text-xs text-slate-500">
          Only users without a staff record are listed. Create the user account first if they&apos;re not here.
        </p>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-100 pt-5">
        <legend className="sr-only">Role</legend>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Position" error={errors.position?.message}>
            <Input {...register('position')} placeholder="Registrar" />
          </Field>
          <Field label="Department">
            <Input {...register('department')} placeholder="Admissions (optional)" list="staff-departments" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <datalist id="staff-departments">
          {departments.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </fieldset>

      <FormError message={serverError} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || users.length === 0}>
          {isSubmitting ? 'Adding…' : 'Add staff member'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Edit

const editStaffSchema = z.object({
  position: z.string().trim().min(1, 'Enter their position'),
  department: z.string().optional(),
  branchId: z.string().optional(),
  status: z.enum(STAFF_STATUSES),
});
type EditStaffValues = z.infer<typeof editStaffSchema>;

function EditStaffForm({
  member,
  branches,
  departments,
  onSaved,
}: {
  member: StaffMember;
  branches: Branch[];
  departments: string[];
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditStaffValues>({
    resolver: zodResolver(editStaffSchema),
    defaultValues: {
      position: member.position,
      department: member.department ?? '',
      branchId: member.branchId ?? '',
      status: member.status,
    },
  });

  const onSubmit = async (values: EditStaffValues) => {
    setServerError(null);
    try {
      await apiClient.patch(`/v1/staff/${member.id}`, {
        position: values.position,
        // Blank clears: `null` unassigns the branch / removes the department.
        department: values.department?.trim() || null,
        branchId: values.branchId || null,
        status: values.status,
      });
      onSaved();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not save changes. Try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
        <Avatar member={member} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {member.user.firstName} {member.user.lastName}
          </p>
          <p className="truncate text-xs text-slate-500">{member.user.email}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Position" error={errors.position?.message}>
          <Input {...register('position')} />
        </Field>
        <Field label="Department">
          <Input {...register('department')} list="staff-departments-edit" />
        </Field>
      </div>
      <datalist id="staff-departments-edit">
        {departments.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
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

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Status</legend>
        <div className="grid grid-cols-3 gap-2">
          {STAFF_STATUSES.map((status) => (
            <label
              key={status}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-red-700 has-[:checked]:bg-red-50 has-[:checked]:text-red-800 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-red-600"
            >
              <input type="radio" value={status} {...register('status')} className="sr-only" />
              {humanize(status)}
            </label>
          ))}
        </div>
      </fieldset>

      <FormError message={serverError} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function StaffPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');

  const canCreate = hasPermission('staff.create');
  const canUpdate = hasPermission('staff.update');
  const canBranches = hasPermission('branches.view');

  const staffQuery = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => (await apiClient.get('/v1/staff')).data,
  });

  // Loaded up front (when allowed) so the table can show branch names, not ids.
  const branchesQuery = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
    enabled: canBranches || showForm || editing !== null,
  });

  const usersQuery = useQuery<OrgUser[]>({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.get('/v1/users')).data,
    enabled: showForm,
  });

  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data]);
  const branchName = useMemo(
    () => new Map((branchesQuery.data ?? []).map((b) => [b.id, b.name])),
    [branchesQuery.data],
  );
  const departments = useMemo(
    () => Array.from(new Set(staff.map((s) => s.department).filter((d): d is string => !!d))).sort(),
    [staff],
  );
  const availableUsers = useMemo(() => {
    const taken = new Set(staff.map((s) => s.user.id));
    return (usersQuery.data ?? []).filter((u) => !taken.has(u.id));
  }, [usersQuery.data, staff]);

  const counts: Record<StatusFilter, number> = { all: staff.length, ACTIVE: 0, ON_LEAVE: 0, ARCHIVED: 0 };
  for (const s of staff) counts[s.status] = (counts[s.status] ?? 0) + 1;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter(
      (s) =>
        (statusFilter === 'all' || s.status === statusFilter) &&
        (!department || s.department === department) &&
        (!q ||
          `${s.user.firstName} ${s.user.lastName}`.toLowerCase().includes(q) ||
          s.user.email.toLowerCase().includes(q) ||
          s.position.toLowerCase().includes(q)),
    );
  }, [staff, statusFilter, department, search]);

  const newThisYear = staff.filter(
    (s) => s.hireDate && new Date(s.hireDate).getFullYear() === new Date().getFullYear(),
  ).length;

  const tiles = [
    { label: 'Total staff', value: staff.length, detail: `${counts.ARCHIVED} archived`, icon: adminIcons.users, tone: 'bg-red-700 text-white' },
    { label: 'Active', value: counts.ACTIVE, detail: `${counts.ON_LEAVE} on leave`, icon: adminIcons.checkSquare, tone: 'bg-amber-400 text-slate-900' },
    { label: 'Departments', value: departments.length, detail: `${staff.filter((s) => !s.department).length} without one`, icon: adminIcons.layers, tone: 'bg-slate-900 text-white' },
    { label: 'Hired this year', value: newThisYear, detail: `${new Date().getFullYear()} to date`, icon: adminIcons.userPlus, tone: 'bg-amber-400 text-slate-900' },
  ];

  const tabs: StatusFilter[] = ['all', 'ACTIVE', 'ON_LEAVE', 'ARCHIVED'];
  const lookupsLoading = branchesQuery.isLoading || usersQuery.isLoading;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff'] });

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Non-teaching personnel: registrars, cashiers, coordinators and admin."
        action={
          canCreate && (
            <Button onClick={() => setShowForm(true)} className="inline-flex shrink-0 items-center gap-1.5">
              {plusIcon}
              Add staff member
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Add staff member">
        {lookupsLoading && <DrawerSkeleton />}
        {!lookupsLoading && (branchesQuery.isError || usersQuery.isError) && (
          <ErrorState message="Couldn't load users or branches. Close this panel and try again." />
        )}
        {!lookupsLoading && !branchesQuery.isError && !usersQuery.isError && (
          <CreateStaffForm
            users={availableUsers}
            branches={branchesQuery.data ?? []}
            departments={departments}
            onCreated={() => {
              setShowForm(false);
              refresh();
            }}
          />
        )}
      </Drawer>

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title="Edit staff member">
        {branchesQuery.isLoading && <DrawerSkeleton />}
        {editing && !branchesQuery.isLoading && (
          <EditStaffForm
            key={editing.id}
            member={editing}
            branches={branchesQuery.data ?? []}
            departments={departments}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}
      </Drawer>

      {staffQuery.isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}
      {staffQuery.isError && <ErrorState message="Couldn't load staff. Refresh the page to try again." />}
      {staffQuery.data && staff.length === 0 && (
        <EmptyState
          title="No staff members yet"
          description="Add registrars, cashiers and coordinators so they can be given roles and branches."
        />
      )}

      {staff.length > 0 && (
        <div className="space-y-6">
          <section aria-label="Staff summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label} className="flex items-center gap-4 p-5">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.tone}`} aria-hidden="true">
                  {t.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">{t.label}</p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">{t.value}</p>
                  <p className="truncate text-xs text-slate-500">{t.detail}</p>
                </div>
              </Card>
            ))}
          </section>

          <section aria-labelledby="directory-heading">
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id="directory-heading" className="text-sm font-semibold text-slate-900">
                    Directory
                  </h2>
                  <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label="Filter by status">
                    {tabs.map((id) => {
                      const active = statusFilter === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setStatusFilter(id)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                            active ? 'bg-red-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {id === 'all' ? 'All' : humanize(id)}
                          <span className={`ml-1.5 tabular-nums ${active ? 'text-red-100' : 'text-slate-400'}`}>
                            {counts[id]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {departments.length > 0 && (
                    <label className="block sm:w-48">
                      <span className="sr-only">Filter by department</span>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-red-600 focus:outline-none"
                      >
                        <option value="">All departments</option>
                        {departments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="relative block sm:w-64">
                    <span className="sr-only">Search staff</span>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {baseIcons.search}
                    </span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Name, email or position"
                      className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-red-600 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="px-4 py-14 text-center text-sm text-slate-500">
                  No staff match these filters.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setDepartment('');
                      setSearch('');
                    }}
                    className="font-medium text-red-700 hover:underline"
                  >
                    Clear filters
                  </button>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">Staff member</th>
                        <th scope="col" className="px-4 py-3 font-medium">Position</th>
                        <th scope="col" className="px-4 py-3 font-medium">Branch</th>
                        <th scope="col" className="px-4 py-3 font-medium">Hired</th>
                        <th scope="col" className="px-4 py-3 font-medium">Status</th>
                        {canUpdate && (
                          <th scope="col" className="px-4 py-3">
                            <span className="sr-only">Actions</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visible.map((s) => (
                        <tr key={s.id} className={`transition-colors hover:bg-slate-50 ${s.status === 'ARCHIVED' ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar member={s} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900">
                                  {s.user.firstName} {s.user.lastName}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {s.user.email}
                                  {s.user.phone && <span className="text-slate-400"> · {s.user.phone}</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-800">{s.position}</p>
                            <p className="text-xs text-slate-500">{s.department ?? 'No department'}</p>
                          </td>
                          <td className="px-4 py-3">
                            {s.branchId ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-700 [&_svg]:h-3.5 [&_svg]:w-3.5">
                                <span className="text-slate-400">{adminIcons.mapPin}</span>
                                {branchName.get(s.branchId) ?? 'Assigned'}
                              </span>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {s.hireDate ? (
                              <>
                                <p className="tabular-nums text-slate-700">
                                  {new Date(s.hireDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-500">{tenure(s.hireDate)}</p>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={s.status} />
                          </td>
                          {canUpdate && (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setEditing(s)}
                                aria-label={`Edit ${s.user.firstName} ${s.user.lastName}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                              >
                                {pencilIcon}
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {visible.length > 0 && visible.length < staff.length && (
                <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                  Showing {visible.length} of {staff.length}
                </p>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
