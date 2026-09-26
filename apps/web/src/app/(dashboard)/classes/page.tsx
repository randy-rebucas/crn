'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';

interface Branch {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  name: string;
  programId: string;
  branchId: string;
  program: { id: string; name: string };
}

interface Course {
  id: string;
  name: string;
  code: string;
  programId: string;
}

interface Room {
  id: string;
  name: string;
  capacity: number | null;
  branchId: string;
}

interface InstructorProfile {
  id: string;
  user: { firstName: string; lastName: string };
}

type ClassStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface ClassRecord {
  id: string;
  name: string;
  status: ClassStatus;
  branchId: string;
  course: { id: string; name: string; code: string };
  batch: { id: string; name: string };
  room: Room | null;
  instructor: { id: string; user: { firstName: string; lastName: string } } | null;
  /** Students ENROLLED in the class's batch, counted by the API. */
  enrolledCount?: number;
}

interface Schedule {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const STATUS_ORDER: ClassStatus[] = ['ACTIVE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

const STATUS_META: Record<ClassStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: '#059669' },
  SCHEDULED: { label: 'Scheduled', color: '#2563eb' },
  COMPLETED: { label: 'Completed', color: '#d97706' },
  CANCELLED: { label: 'Cancelled', color: '#94a3b8' },
};

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const icons = {
  layers: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 3.5 8 4.3-8 4.3-8-4.3 8-4.3Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="m4 12.3 8 4.3 8-4.3M4 16.3l8 4.3 8-4.3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  door: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M6 20.5V4.8A1.3 1.3 0 0 1 7.3 3.5h9.4A1.3 1.3 0 0 1 18 4.8v15.7M4 20.5h16" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={14.5} cy={12.5} r={0.9} fill="currentColor" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={8.5} cy={8} r={3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={16.5} cy={9.5} r={2.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3 20c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5M15 20c.6-2.4 2-4 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx={12} cy={8} r={3.3} stroke="currentColor" strokeWidth={1.8} />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <circle cx={12} cy={9.5} r={2.4} stroke="currentColor" strokeWidth={1.8} />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx={12} cy={12} r={8} stroke="currentColor" strokeWidth={1.8} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M12 4 21 19.5H3L12 4Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={12} cy={16.8} r={0.9} fill="currentColor" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m5.5 12.5 4 4 9-9.5" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  pieChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M12 3.8V12l7 3.3A8.2 8.2 0 1 1 12 3.8Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M13.5 3.9A8.2 8.2 0 0 1 19.9 11h-7.4l1-7.1Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
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

function instructorName(cls: ClassRecord) {
  return cls.instructor ? `${cls.instructor.user.firstName} ${cls.instructor.user.lastName}` : null;
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

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

function StatStrip({ stats }: { stats: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'warn' }[] }) {
  return (
    <Card className={`mb-6 grid grid-cols-2 lg:divide-x lg:divide-slate-100 ${stats.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-3 p-4 sm:p-5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              stat.tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {stat.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tabular-nums text-slate-900 sm:text-lg">{stat.value}</div>
            <div className="text-xs leading-snug text-slate-500">{stat.label}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{placeholder}</span>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icons.search}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
      />
    </label>
  );
}

function FillMeter({ value, max }: { value: number; max: number | null }) {
  if (max === null || max <= 0) {
    return <span className="tabular-nums text-slate-700">{value}</span>;
  }
  const pct = Math.round((value / max) * 100);
  const over = value > max;
  return (
    <div className="w-28">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className={`font-semibold tabular-nums ${over ? 'text-red-700' : 'text-slate-900'}`}>
          {value}
          <span className="font-normal text-slate-400"> / {max}</span>
        </span>
        <span className="tabular-nums text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-700' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-600'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

const createClassSchema = z.object({
  batchId: z.string().min(1, 'Choose a batch'),
  courseId: z.string().min(1, 'Choose a course'),
  branchId: z.string().min(1, 'Choose a branch'),
  name: z.string().trim().min(1, 'Give the class a name'),
  instructorProfileId: z.string().optional(),
  roomId: z.string().optional(),
});
type CreateClassValues = z.infer<typeof createClassSchema>;

function CreateClassForm({
  batches,
  branches,
  rooms,
  instructors,
  onCreated,
}: {
  batches: Batch[];
  branches: Branch[];
  rooms: Room[];
  instructors: InstructorProfile[];
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateClassValues>({
    resolver: zodResolver(createClassSchema),
    defaultValues: { batchId: '', courseId: '', branchId: '', name: '', instructorProfileId: '', roomId: '' },
  });

  const [selectedBatchId, selectedBranchId, selectedRoomId] = useWatch({
    control,
    name: ['batchId', 'branchId', 'roomId'],
  });
  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const branchRooms = rooms.filter((r) => r.branchId === selectedBranchId);

  // A batch belongs to one branch, so the class does too — follow the batch
  // instead of letting the two disagree, and drop a room from another branch.
  useEffect(() => {
    if (!selectedBatch) return;
    setValue('branchId', selectedBatch.branchId, { shouldValidate: true });
    setValue('courseId', '');
  }, [selectedBatch, setValue]);

  useEffect(() => {
    if (selectedRoomId && !rooms.some((r) => r.id === selectedRoomId && r.branchId === selectedBranchId)) {
      setValue('roomId', '');
    }
  }, [selectedBranchId, selectedRoomId, rooms, setValue]);

  const { data: courses, isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['courses', selectedBatch?.programId],
    queryFn: async () =>
      (await apiClient.get('/v1/courses', { params: { programId: selectedBatch?.programId } })).data,
    enabled: Boolean(selectedBatch?.programId),
  });

  const onSubmit = async (values: CreateClassValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/classes', {
        ...values,
        instructorProfileId: values.instructorProfileId || undefined,
        roomId: values.roomId || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create the class. Check your connection and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">What it teaches</legend>
        <Field label="Batch" error={errors.batchId?.message}>
          <Select {...register('batchId')}>
            <option value="" disabled>
              Select batch…
            </option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.program.name})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Course" error={errors.courseId?.message}>
          <Select {...register('courseId')} disabled={!selectedBatchId || coursesLoading}>
            <option value="" disabled>
              {!selectedBatchId
                ? 'Select a batch first'
                : coursesLoading
                  ? 'Loading courses…'
                  : courses?.length
                    ? 'Select course…'
                    : 'No courses in this program yet'}
            </option>
            {(courses ?? []).map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} ({course.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Class name" error={errors.name?.message}>
          <Input placeholder="e.g. NCLEX Review - Section C" {...register('name')} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-slate-100 pt-5">
        <legend className="sr-only">Where and who</legend>
        <p className="-mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Where and who</p>
        <Field label="Branch" error={errors.branchId?.message}>
          <Select {...register('branchId')} disabled={Boolean(selectedBatch)}>
            <option value="" disabled>
              Select branch…
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          {selectedBatch && <p className="mt-1 text-xs text-slate-500">Set by the batch.</p>}
        </Field>
        <Field label="Room">
          <Select {...register('roomId')} disabled={!selectedBranchId}>
            <option value="">{selectedBranchId ? 'Unassigned' : 'Choose a branch first'}</option>
            {branchRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
                {room.capacity ? ` · ${room.capacity} seats` : ''}
              </option>
            ))}
          </Select>
          {selectedBranchId && branchRooms.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">This branch has no rooms yet. Add one in the Rooms tab.</p>
          )}
        </Field>
        <Field label="Instructor">
          <Select {...register('instructorProfileId')}>
            <option value="">Unassigned</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.user.firstName} {instructor.user.lastName}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create class'}
        </Button>
      </div>
    </form>
  );
}

const createRoomSchema = z.object({
  branchId: z.string().min(1, 'Choose a branch'),
  name: z.string().trim().min(1, 'Give the room a name'),
  capacity: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) > 0), 'Capacity must be a whole number above 0'),
});
type CreateRoomValues = z.infer<typeof createRoomSchema>;

function CreateRoomForm({ branches, onCreated }: { branches: Branch[]; onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { branchId: branches.length === 1 ? branches[0].id : '', name: '', capacity: '' },
  });

  const onSubmit = async (values: CreateRoomValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/rooms', {
        branchId: values.branchId,
        name: values.name,
        capacity: values.capacity ? Number(values.capacity) : undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, 'Could not create the room. Check your connection and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Branch" error={errors.branchId?.message}>
        <Select {...register('branchId')}>
          <option value="" disabled>
            Select branch…
          </option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <Input placeholder="e.g. Room 101" {...register('name')} />
      </Field>
      <Field label="Capacity (seats)" error={errors.capacity?.message}>
        <Input type="number" min={1} placeholder="Optional" {...register('capacity')} />
      </Field>
      <p className="text-xs text-slate-500">Capacity lets the Classes tab show how full each section is.</p>
      {serverError && <ErrorState message={serverError} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create room'}
        </Button>
      </div>
    </form>
  );
}

function useClassData() {
  const { hasPermission } = useAuth();
  const canRoster = hasPermission('attendance.view');
  const canSchedules = hasPermission('schedules.view');

  const classesQuery = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
  });
  const classes = classesQuery.data ?? [];

  // Headcounts come on the class list itself, and the whole week's meeting
  // times in one query — this used to be two requests per class. Enrollment
  // figures stay behind attendance.view, as the per-class rosters were.
  const schedulesQuery = useQuery<Schedule[]>({
    queryKey: ['schedules', 'all'],
    queryFn: async () => (await apiClient.get('/v1/schedules')).data,
    enabled: canSchedules,
  });

  const enrolled = new Map<string, number>();
  if (canRoster) {
    for (const cls of classes) if (cls.enrolledCount !== undefined) enrolled.set(cls.id, cls.enrolledCount);
  }
  const schedules = new Map<string, Schedule[]>();
  if (schedulesQuery.data) {
    for (const cls of classes) schedules.set(cls.id, []);
    for (const s of schedulesQuery.data) schedules.get(s.classId)?.push(s);
  }

  const rostersLoading = classesQuery.isLoading;

  return { classesQuery, classes, enrolled, schedules, canRoster, canSchedules, rostersLoading };
}

type ClassFilter = 'ALL' | ClassStatus | 'ATTENTION';

function needsAttention(cls: ClassRecord, schedules: Map<string, Schedule[]>, canSchedules: boolean) {
  const issues: string[] = [];
  if (cls.status === 'COMPLETED' || cls.status === 'CANCELLED') return issues;
  if (!cls.instructor) issues.push('No instructor');
  if (!cls.room) issues.push('No room');
  if (canSchedules && schedules.has(cls.id) && (schedules.get(cls.id)?.length ?? 0) === 0) issues.push('No meeting times');
  return issues;
}

function ClassesTab() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ClassFilter>('ALL');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { classesQuery, classes, enrolled, schedules, canRoster, canSchedules, rostersLoading } = useClassData();
  const { isLoading, isError } = classesQuery;

  // Lookups for the create form only: fetched once the drawer opens, and only
  // those the viewer may read (anything else would just 403).
  const { data: batches } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: async () => (await apiClient.get('/v1/batches')).data,
    enabled: showForm && hasPermission('batches.view'),
  });
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
    enabled: showForm && hasPermission('branches.view'),
  });
  const { data: rooms } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => (await apiClient.get('/v1/rooms')).data,
    enabled: showForm && hasPermission('rooms.view'),
  });
  const { data: instructors } = useQuery<InstructorProfile[]>({
    queryKey: ['instructors'],
    queryFn: async () => (await apiClient.get('/v1/instructors')).data,
    enabled: showForm && hasPermission('instructors.view'),
  });

  const statusCounts = STATUS_ORDER.map((s) => ({ status: s, count: classes.filter((c) => c.status === s).length }));
  const attention = classes
    .map((cls) => ({ cls, issues: needsAttention(cls, schedules, canSchedules) }))
    .filter((row) => row.issues.length > 0);
  const totalEnrolled = [...enrolled.values()].reduce((a, b) => a + b, 0);
  const openClasses = classes.filter((c) => c.status === 'ACTIVE' || c.status === 'SCHEDULED').length;

  // Plotted as share of the room so a 100-seat hall and a 30-seat room read
  // on the same scale; raw counts ride along as the bar label and tooltip.
  const fillData = classes
    .filter((c) => enrolled.has(c.id) && c.room?.capacity)
    .map((c) => {
      const count = enrolled.get(c.id) ?? 0;
      const capacity = c.room?.capacity ?? 1;
      const pct = Math.round((count / capacity) * 100);
      return {
        name: c.name.split(/\s[-–—]\s/).pop() ?? c.name,
        fullName: c.name,
        count,
        capacity,
        enrolledPct: Math.min(100, pct),
        openPct: Math.max(0, 100 - pct),
        label: `${count} / ${capacity}`,
      };
    });
  const noCapacity = classes.filter((c) => enrolled.has(c.id) && !c.room?.capacity);

  const q = search.trim().toLowerCase();
  const visible = classes.filter((cls) => {
    if (filter === 'ATTENTION' && needsAttention(cls, schedules, canSchedules).length === 0) return false;
    if (filter !== 'ALL' && filter !== 'ATTENTION' && cls.status !== filter) return false;
    if (!q) return true;
    return [cls.name, cls.course.name, cls.course.code, cls.batch.name, instructorName(cls) ?? '', cls.room?.name ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const chips: { key: ClassFilter; label: string; count: number; color?: string }[] = [
    { key: 'ALL', label: 'All', count: classes.length },
    ...statusCounts
      .filter((s) => s.count > 0)
      .map((s) => ({ key: s.status as ClassFilter, label: STATUS_META[s.status].label, count: s.count, color: STATUS_META[s.status].color })),
    ...(attention.length > 0 ? [{ key: 'ATTENTION' as ClassFilter, label: 'Needs attention', count: attention.length, color: '#d97706' }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Class sections tied to a batch, course, room, and instructor."
        action={
          hasPermission('classes.create') && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New class
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New class">
        <CreateClassForm
          batches={batches ?? []}
          branches={branches ?? []}
          rooms={rooms ?? []}
          instructors={instructors ?? []}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['classes'] });
          }}
        />
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load classes. Refresh the page to try again." />}
      {!isLoading && !isError && classes.length === 0 && (
        <EmptyState title="No classes yet" description="Create the first class section to start scheduling and taking attendance." />
      )}

      {classes.length > 0 && (
        <>
          <StatStrip
            stats={[
              { icon: icons.layers, label: 'Classes', value: classes.length },
              { icon: icons.check, label: 'Active or scheduled', value: openClasses },
              ...(canRoster ? [{ icon: icons.users, label: 'Students enrolled', value: totalEnrolled }] : []),
              {
                icon: icons.alert,
                label: 'Need attention',
                value: attention.length,
                tone: attention.length > 0 ? ('warn' as const) : undefined,
              },
            ]}
          />

          <div className="mb-6 grid gap-6 lg:grid-cols-5">
            <SectionCard
              icon={canRoster ? icons.barChart : icons.pieChart}
              title={canRoster ? 'Seats filled' : 'By status'}
              meta={canRoster ? 'Enrolled vs. room capacity' : undefined}
              className="lg:col-span-3"
            >
              {canRoster ? (
                rostersLoading ? (
                  <LoadingState />
                ) : fillData.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Nothing to chart yet — assign rooms with a seat capacity to see how full each class is.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={Math.max(160, fillData.length * 44 + 30)}>
                      <BarChart data={fillData} layout="vertical" barCategoryGap="28%" margin={{ left: 0, right: 76 }}>
                        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                          formatter={(value, key, item) =>
                            key === 'openPct'
                              ? [`${item.payload.capacity - item.payload.count} seats (${value}%)`, 'Open']
                              : [`${item.payload.count} students (${value}%)`, 'Enrolled']
                          }
                        />
                        <Bar dataKey="enrolledPct" stackId="s" fill="#b91c1c" isAnimationActive={false} />
                        <Bar dataKey="openPct" stackId="s" fill="#e2e8f0" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                          <LabelList dataKey="label" position="right" style={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-red-700" />
                        Enrolled
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                        Open seats
                      </span>
                    </div>
                    {noCapacity.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        Not shown, room has no capacity set: {noCapacity.map((c) => c.name).join(', ')}.
                      </p>
                    )}
                  </>
                )
              ) : (
                <StatusDonut counts={statusCounts} total={classes.length} />
              )}
            </SectionCard>

            <SectionCard
              icon={icons.alert}
              title="Needs attention"
              meta={attention.length > 0 ? `${attention.length} ${attention.length === 1 ? 'class' : 'classes'}` : undefined}
              className="lg:col-span-2"
            >
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {icons.check}
                  Every open class has an instructor, a room{canSchedules ? ', and meeting times' : ''}.
                </div>
              ) : (
                <ul className="space-y-2">
                  {attention.map(({ cls, issues }) => (
                    <li key={cls.id} className="rounded-lg border border-slate-100 px-3 py-2.5">
                      <div className="truncate text-sm font-medium text-slate-900">{cls.name}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {issues.map((issue) => (
                          <span key={issue} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canRoster && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-medium text-slate-500">By status</p>
                  <StatusBar counts={statusCounts} total={classes.length} />
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            icon={icons.layers}
            title="All classes"
            meta={visible.length !== classes.length ? `${visible.length} of ${classes.length}` : `${classes.length}`}
            action={<SearchInput value={search} onChange={setSearch} placeholder="Search class, course, instructor" />}
          >
            <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter classes">
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
                    {chip.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />}
                    {chip.label}
                    <span className={`tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>{chip.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Phones: one stacked row per class instead of a five-column table. */}
            <ul className="-mx-5 divide-y divide-slate-100 border-t border-slate-100 md:hidden">
              {visible.map((cls) => {
                const sched = schedules.get(cls.id);
                const minutes = (sched ?? []).reduce((sum, s) => sum + toMinutes(s.endTime) - toMinutes(s.startTime), 0);
                return (
                  <li key={cls.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{cls.name}</div>
                        <div className="text-xs text-slate-500">
                          {cls.course.code} · {cls.batch.name}
                        </div>
                      </div>
                      <StatusBadge status={cls.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className={`flex items-center gap-1.5 ${cls.instructor ? 'text-slate-600' : 'text-amber-700'}`}>
                        {icons.person}
                        {instructorName(cls) ?? 'No instructor'}
                      </span>
                      <span className={`flex items-center gap-1.5 ${cls.room ? 'text-slate-600' : 'text-amber-700'}`}>
                        {icons.pin}
                        {cls.room ? cls.room.name : 'No room'}
                      </span>
                      {canSchedules && sched && (
                        <span className={`flex items-center gap-1.5 ${sched.length ? 'text-slate-600' : 'text-amber-700'}`}>
                          {icons.clock}
                          {sched.length ? `${formatHours(minutes)} / week` : 'No meeting times'}
                        </span>
                      )}
                    </div>
                    {canRoster && enrolled.has(cls.id) && (
                      <div className="mt-3">
                        <FillMeter value={enrolled.get(cls.id) ?? 0} max={cls.room?.capacity ?? null} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="-mx-5 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Class</th>
                    <th className="px-5 py-2.5 font-medium">Instructor &amp; room</th>
                    {canRoster && <th className="px-5 py-2.5 font-medium">Enrolled</th>}
                    {canSchedules && <th className="hidden px-5 py-2.5 font-medium lg:table-cell">Weekly</th>}
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((cls) => {
                    const sched = schedules.get(cls.id);
                    const minutes = (sched ?? []).reduce((sum, s) => sum + toMinutes(s.endTime) - toMinutes(s.startTime), 0);
                    const days = [...new Set((sched ?? []).map((s) => s.dayOfWeek))]
                      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                      .map((d) => DAY_SHORT[d]);
                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{cls.name}</div>
                          <div className="text-xs text-slate-500">
                            {cls.course.name} ({cls.course.code}) · {cls.batch.name}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="space-y-1 text-xs">
                            <div className={`flex items-center gap-1.5 ${cls.instructor ? 'text-slate-700' : 'text-amber-700'}`}>
                              {icons.person}
                              {instructorName(cls) ?? 'No instructor'}
                            </div>
                            <div className={`flex items-center gap-1.5 ${cls.room ? 'text-slate-700' : 'text-amber-700'}`}>
                              {icons.pin}
                              {cls.room ? cls.room.name : 'No room'}
                            </div>
                          </div>
                        </td>
                        {canRoster && (
                          <td className="px-5 py-3">
                            {enrolled.has(cls.id) ? (
                              <FillMeter value={enrolled.get(cls.id) ?? 0} max={cls.room?.capacity ?? null} />
                            ) : (
                              <span className="text-xs text-slate-400">…</span>
                            )}
                          </td>
                        )}
                        {canSchedules && (
                          <td className="hidden px-5 py-3 lg:table-cell">
                            {!sched ? (
                              <span className="text-xs text-slate-400">…</span>
                            ) : sched.length === 0 ? (
                              <span className="text-xs text-amber-700">No meeting times</span>
                            ) : (
                              <div className="text-xs">
                                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                                  {icons.clock}
                                  {formatHours(minutes)}
                                </div>
                                <div className="mt-0.5 text-slate-500">{days.join(', ')}</div>
                              </div>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-3">
                          <StatusBadge status={cls.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visible.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No classes match</p>
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
                    clear the filters
                  </button>
                  .
                </p>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

function StatusBar({ counts, total }: { counts: { status: ClassStatus; count: number }[]; total: number }) {
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {counts
          .filter((c) => c.count > 0)
          .map((c) => (
            <div
              key={c.status}
              style={{ width: `${(c.count / total) * 100}%`, backgroundColor: STATUS_META[c.status].color }}
              title={`${STATUS_META[c.status].label}: ${c.count}`}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {counts
          .filter((c) => c.count > 0)
          .map((c) => (
            <span key={c.status} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[c.status].color }} />
              {STATUS_META[c.status].label}
              <span className="font-medium tabular-nums text-slate-900">{c.count}</span>
            </span>
          ))}
      </div>
    </div>
  );
}

function StatusDonut({ counts, total }: { counts: { status: ClassStatus; count: number }[]; total: number }) {
  const data = counts
    .filter((c) => c.count > 0)
    .map((c) => ({ ...c, name: STATUS_META[c.status].label, fill: STATUS_META[c.status].color }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={2} strokeWidth={0} isAnimationActive={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold tabular-nums text-slate-900">{total}</div>
          <div className="text-xs text-slate-500">classes</div>
        </div>
      </div>
      <div className="w-full flex-1">
        <StatusBar counts={counts} total={total} />
      </div>
    </div>
  );
}

function RoomsTab() {
  const { hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => (await apiClient.get('/v1/rooms')).data,
  });
  const canBranches = hasPermission('branches.view');
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await apiClient.get('/v1/branches')).data,
    enabled: canBranches,
  });
  const { data: classes = [] } = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
    enabled: hasPermission('classes.view'),
  });

  const rooms = data ?? [];
  const branchesById = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const classesByRoom = new Map<string, ClassRecord[]>();
  for (const cls of classes) {
    if (!cls.room) continue;
    classesByRoom.set(cls.room.id, [...(classesByRoom.get(cls.room.id) ?? []), cls]);
  }

  const totalSeats = rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
  const inUse = rooms.filter((r) => (classesByRoom.get(r.id)?.length ?? 0) > 0).length;

  // Without branches.view, group by branch id under a generic heading so the
  // rooms still show instead of an empty list.
  const branchList: Branch[] = canBranches
    ? (branches ?? [])
    : [...new Set(rooms.map((r) => r.branchId))].map((id, i) => ({ id, name: `Branch ${i + 1}` }));
  const byBranch = branchList
    .map((b) => ({ branch: b, rooms: rooms.filter((r) => r.branchId === b.id) }))
    .filter((g) => g.rooms.length > 0);
  const maxCapacity = Math.max(1, ...rooms.map((r) => r.capacity ?? 0));

  const q = search.trim().toLowerCase();
  const matches = (room: Room) =>
    !q || `${room.name} ${branchesById.get(room.branchId) ?? ''}`.toLowerCase().includes(q);

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Physical rooms available for scheduling classes."
        action={
          hasPermission('rooms.create') && (
            <Button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New room
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="New room">
        <CreateRoomForm
          branches={branches ?? []}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
          }}
        />
      </Drawer>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message="Could not load rooms. Refresh the page to try again." />}
      {!isLoading && !isError && rooms.length === 0 && (
        <EmptyState title="No rooms yet" description="Add a branch's rooms so classes can be assigned and double-bookings caught." />
      )}

      {rooms.length > 0 && (
        <>
          <StatStrip
            stats={[
              { icon: icons.door, label: 'Rooms', value: rooms.length },
              { icon: icons.users, label: 'Total seats', value: totalSeats || '—' },
              { icon: icons.layers, label: 'Rooms in use', value: `${inUse} of ${rooms.length}` },
            ]}
          />

          <SectionCard
            icon={icons.door}
            title="Rooms by branch"
            meta={`${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}`}
            action={<SearchInput value={search} onChange={setSearch} placeholder="Search rooms" />}
          >
            <div className="space-y-6">
              {byBranch.map(({ branch, rooms: branchRooms }) => {
                const shown = branchRooms.filter(matches);
                if (shown.length === 0) return null;
                const seats = branchRooms.reduce((s, r) => s + (r.capacity ?? 0), 0);
                return (
                  <section key={branch.id}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <span className="text-slate-400">{icons.pin}</span>
                        {branch.name}
                      </h3>
                      <span className="text-xs text-slate-400">
                        {branchRooms.length} {branchRooms.length === 1 ? 'room' : 'rooms'}
                        {seats > 0 && ` · ${seats} seats`}
                      </span>
                    </div>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                      {shown.map((room) => {
                        const used = classesByRoom.get(room.id) ?? [];
                        return (
                          <li key={room.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.2fr)] sm:items-center">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                                {icons.door}
                              </span>
                              <span className="truncate font-medium text-slate-900">{room.name}</span>
                            </div>
                            <div>
                              {room.capacity ? (
                                <>
                                  <div className="mb-1 text-xs text-slate-500">
                                    <span className="font-semibold tabular-nums text-slate-900">{room.capacity}</span> seats
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full bg-slate-400"
                                      style={{ width: `${(room.capacity / maxCapacity) * 100}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs text-slate-400">No capacity set</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {used.length === 0 ? (
                                <span className="text-xs text-slate-400">Not assigned to any class</span>
                              ) : (
                                used.map((cls) => (
                                  <span key={cls.id} className="truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                    {cls.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              {rooms.filter(matches).length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">No rooms match &ldquo;{search}&rdquo;.</p>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

export default function ClassesPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'classes' | 'rooms'>('classes');
  const showRoomsTab = hasPermission('rooms.view');

  const tabs = [
    { key: 'classes' as const, label: 'Classes', icon: icons.layers },
    ...(showRoomsTab ? [{ key: 'rooms' as const, label: 'Rooms', icon: icons.door }] : []),
  ];

  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-6 flex gap-1 border-b border-slate-200" role="tablist">
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                  on ? 'border-red-700 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'classes' || !showRoomsTab ? <ClassesTab /> : <RoomsTab />}
    </div>
  );
}
