'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Card, EmptyState, ErrorState, Field, Input, LoadingState, PageHeader, Select } from '@/components/ui';

interface ClassRecord {
  id: string;
  name: string;
  course: { name: string; code: string };
  batch: { id: string; name: string };
  instructor?: { user: { id: string } } | null;
}

interface RosterStudent {
  id: string;
  user: { firstName: string; lastName: string; email: string };
}

interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

type Status = Attendance['status'];
type RosterFilter = 'ALL' | 'UNMARKED' | Status;

const STATUS_OPTIONS: Status[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

// One place for what each status looks like, so the donut, trend bars,
// filter chips and row controls can never drift apart.
const STATUS_META: Record<Status, { label: string; color: string; active: string; soft: string }> = {
  PRESENT: {
    label: 'Present',
    color: '#059669',
    active: 'bg-emerald-600 text-white border-emerald-600',
    soft: 'bg-emerald-50 text-emerald-700',
  },
  LATE: {
    label: 'Late',
    color: '#f59e0b',
    active: 'bg-amber-500 text-white border-amber-500',
    soft: 'bg-amber-50 text-amber-700',
  },
  ABSENT: {
    label: 'Absent',
    color: '#b91c1c',
    active: 'bg-red-700 text-white border-red-700',
    soft: 'bg-red-50 text-red-700',
  },
  EXCUSED: {
    label: 'Excused',
    color: '#3b82f6',
    active: 'bg-blue-600 text-white border-blue-600',
    soft: 'bg-blue-50 text-blue-700',
  },
};

const UNMARKED_COLOR = '#e2e8f0';

const statusIcons: Record<Status, React.ReactNode> = {
  PRESENT: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m5.5 12.5 4 4 9-9.5" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  LATE: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={12} r={8} stroke="currentColor" strokeWidth={1.8} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ABSENT: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
    </svg>
  ),
  EXCUSED: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M7 3.5h7l4 4V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="m9 13.5 2 2 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const uiIcons = {
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m14.5 6-6 6 6 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m9.5 6 6 6-6 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={11} cy={11} r={6.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={8.5} cy={8} r={3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={16.5} cy={9.5} r={2.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3 20c.8-3.3 3-5 5.5-5s4.7 1.7 5.5 5M15 20c.6-2.4 2-4 4-4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  pieChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M12 3.8V12l7 3.3A8.2 8.2 0 1 1 12 3.8Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M13.5 3.9A8.2 8.2 0 0 1 19.9 11h-7.4l1-7.1Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
};

// Local calendar day, not UTC — toISOString() would roll "today" back a day
// for anyone east of Greenwich before their local 8am (e.g. Manila, UTC+8).
function toDayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftDay(key: string, days: number) {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return toDayKey(d);
}

function shortDate(key: string) {
  return parseDayKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function longDate(key: string) {
  return parseDayKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

type Counts = Record<Status, number>;

function emptyCounts(): Counts {
  return { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
}

// "Attended" = present or late, over every marked record — excused counts
// in the denominator so the rate never looks better than the room did.
function attendedRate(counts: Counts) {
  const marked = counts.PRESENT + counts.LATE + counts.ABSENT + counts.EXCUSED;
  return marked > 0 ? Math.round(((counts.PRESENT + counts.LATE) / marked) * 100) : null;
}

// Below this, a student's class record is flagged red in the roster. A UI
// cue, not a center policy — change it here if the center sets one.
const LOW_ATTENDANCE_PCT = 75;

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

function SessionSummary({ counts, rosterSize }: { counts: Counts; rosterSize: number }) {
  const marked = counts.PRESENT + counts.LATE + counts.ABSENT + counts.EXCUSED;
  const unmarked = Math.max(0, rosterSize - marked);
  const rate = attendedRate(counts);
  const slices = [
    ...STATUS_OPTIONS.map((s) => ({ key: s, name: STATUS_META[s].label, value: counts[s], color: STATUS_META[s].color })),
    { key: 'UNMARKED', name: 'Not marked', value: unmarked, color: UNMARKED_COLOR },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.length ? slices : [{ key: 'none', name: 'No students', value: 1, color: UNMARKED_COLOR }]}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={slices.length > 1 ? 2 : 0}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {(slices.length ? slices : [{ key: 'none', color: UNMARKED_COLOR }]).map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            {slices.length > 0 && <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold tabular-nums text-slate-900">{rate === null ? '—' : `${rate}%`}</div>
          <div className="text-xs text-slate-500">{marked > 0 ? `of ${marked} marked` : 'none marked'}</div>
        </div>
      </div>

      <div className="w-full min-w-0 flex-1">
        <ul className="space-y-2.5">
          {STATUS_OPTIONS.map((s) => (
            <li key={s} className="flex items-center gap-2.5 text-sm">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${STATUS_META[s].soft}`}>
                {statusIcons[s]}
              </span>
              <span className="flex-1 text-slate-600">{STATUS_META[s].label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{counts[s]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-500">Marked</span>
            <span className="font-medium tabular-nums text-slate-700">
              {marked} of {rosterSize}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-red-700 transition-[width] duration-300 ease-out"
              style={{ width: `${rosterSize > 0 ? Math.min(100, (marked / rosterSize) * 100) : 0}%` }}
            />
          </div>
          {unmarked > 0 && <p className="mt-2 text-xs text-slate-500">{unmarked} still to mark for this session.</p>}
        </div>
      </div>
    </div>
  );
}

interface TrendPoint extends Counts {
  date: string;
  label: string;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const rate = attendedRate(point);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-slate-900">{longDate(point.date)}</div>
      {STATUS_OPTIONS.map((s) => (
        <div key={s} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
            {STATUS_META[s].label}
          </span>
          <span className="tabular-nums text-slate-900">{point[s]}</span>
        </div>
      ))}
      {rate !== null && (
        <div className="mt-1 border-t border-slate-100 pt-1 font-medium text-slate-700">{rate}% attended</div>
      )}
    </div>
  );
}

function AttendanceTrendChart({
  data,
  selectedDate,
  onSelect,
}: {
  data: TrendPoint[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const stack = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'] as const;
  const selected = data.find((p) => p.date === selectedDate);
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          {selected && <ReferenceArea x1={selected.label} x2={selected.label} fill="#fef2f2" fillOpacity={1} ifOverflow="extendDomain" />}
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string } }) => {
              const value = props.payload?.value ?? '';
              const on = value === selected?.label;
              return (
                <text
                  x={Number(props.x)}
                  y={Number(props.y) + 12}
                  textAnchor="middle"
                  fontSize={12}
                  fill={on ? '#b91c1c' : '#64748b'}
                  fontWeight={on ? 600 : 400}
                >
                  {value}
                </text>
              );
            }}
          />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip cursor={{ fill: '#f8fafc' }} content={<TrendTooltip />} />
          {stack.map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              name={STATUS_META[s].label}
              stackId="a"
              fill={STATUS_META[s].color}
              radius={i === stack.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              className="cursor-pointer"
              onClick={(_, index) => onSelect(data[index].date)}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {STATUS_OPTIONS.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_META[s].color }} />
            {STATUS_META[s].label}
          </span>
        ))}
        <span className="ml-auto text-slate-400">Select a bar to open that session</span>
      </div>
    </div>
  );
}

function initials(student: RosterStudent) {
  return `${student.user.firstName.charAt(0)}${student.user.lastName.charAt(0)}`.toUpperCase();
}

// Shared by (dashboard)/attendance (org-wide) and (instructor)/instructor/attendance
// (`myClassesOnly` narrows the class picker to sections the caller teaches) so the
// two shells don't fork the marking logic — only which classes are selectable differs.
export function AttendanceView({
  myClassesOnly = false,
  initialClassId,
}: {
  myClassesOnly?: boolean;
  // Preselects a class when linked from elsewhere (e.g. the instructor's
  // Classes page); ignored if it isn't one of the selectable classes.
  initialClassId?: string;
}) {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [classFilter, setClassFilter] = useState(initialClassId ?? '');
  const [date, setDate] = useState(() => toDayKey(new Date()));
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('ALL');
  const [search, setSearch] = useState('');
  const [markError, setMarkError] = useState<string | null>(null);

  const today = toDayKey(new Date());

  const { data: allClasses, isLoading: classesLoading } = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
  });

  const classes = useMemo(
    () => (myClassesOnly ? (allClasses ?? []).filter((c) => c.instructor?.user.id === user?.id) : allClasses ?? []),
    [allClasses, myClassesOnly, user?.id],
  );

  const classId = (classes.some((c) => c.id === classFilter) ? classFilter : classes[0]?.id) || '';
  const selectedClass = classes.find((c) => c.id === classId);

  const { data: roster = [], isLoading: rosterLoading } = useQuery<RosterStudent[]>({
    queryKey: ['classes', classId, 'roster'],
    queryFn: async () => (await apiClient.get(`/v1/classes/${classId}/roster`)).data,
    enabled: Boolean(classId),
  });

  const {
    data: attendanceRecords,
    isLoading: attendanceLoading,
    isError: attendanceError,
  } = useQuery<Attendance[]>({
    queryKey: ['attendance', classId],
    queryFn: async () => (await apiClient.get('/v1/attendance', { params: { classId } })).data,
    enabled: Boolean(classId),
  });

  const attendanceByStudent = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const record of attendanceRecords ?? []) {
      // date comes back as an ISO datetime; compare by day only.
      if (record.date.slice(0, 10) === date) {
        map.set(record.studentId, record);
      }
    }
    return map;
  }, [attendanceRecords, date]);

  const dayCounts = useMemo(() => {
    const counts = emptyCounts();
    for (const record of attendanceByStudent.values()) counts[record.status] += 1;
    return counts;
  }, [attendanceByStudent]);

  // Last 12 sessions that have any records, oldest first — the class's own
  // history, not a calendar grid padded with empty days.
  const trend = useMemo<TrendPoint[]>(() => {
    const byDate = new Map<string, Counts>();
    for (const record of attendanceRecords ?? []) {
      const key = record.date.slice(0, 10);
      const counts = byDate.get(key) ?? emptyCounts();
      counts[record.status] += 1;
      byDate.set(key, counts);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, counts]) => ({ date: key, label: shortDate(key), ...counts }));
  }, [attendanceRecords]);

  // Each student's record across every session this class has logged.
  const studentHistory = useMemo(() => {
    const map = new Map<string, Counts>();
    for (const record of attendanceRecords ?? []) {
      const counts = map.get(record.studentId) ?? emptyCounts();
      counts[record.status] += 1;
      map.set(record.studentId, counts);
    }
    return map;
  }, [attendanceRecords]);

  const unmarkedCount = roster.filter((s) => !attendanceByStudent.has(s.id)).length;

  const visibleRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((student) => {
      const status = attendanceByStudent.get(student.id)?.status;
      if (rosterFilter === 'UNMARKED' && status) return false;
      if (rosterFilter !== 'ALL' && rosterFilter !== 'UNMARKED' && status !== rosterFilter) return false;
      if (!q) return true;
      const { firstName, lastName, email } = student.user;
      return `${firstName} ${lastName} ${email}`.toLowerCase().includes(q);
    });
  }, [roster, attendanceByStudent, rosterFilter, search]);

  const mark = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: Status }) =>
      apiClient.post('/v1/attendance', { studentId, classId, date, status }),
    onSuccess: () => {
      setMarkError(null);
      return queryClient.invalidateQueries({ queryKey: ['attendance', classId] });
    },
    onError: (err) => {
      const message = isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined;
      setMarkError(message ?? 'Could not mark attendance. Check your connection and try again.');
    },
  });

  const canMark = hasPermission('attendance.create');
  const pendingStudentId = mark.isPending ? mark.variables?.studentId : undefined;
  const loadingClassData = Boolean(classId) && (rosterLoading || attendanceLoading);

  const filterChips: { key: RosterFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: roster.length },
    { key: 'UNMARKED', label: 'Not marked', count: unmarkedCount },
    ...STATUS_OPTIONS.map((s) => ({ key: s as RosterFilter, label: STATUS_META[s].label, count: dayCounts[s] })),
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={
          myClassesOnly
            ? 'Mark and review attendance for your classes on a given date.'
            : 'Mark and review attendance for a class on a given date.'
        }
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Class">
            <Select value={classId} onChange={(e) => setClassFilter(e.target.value)} disabled={classesLoading || classes.length === 0}>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} — {cls.course.name} ({cls.batch.name})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Session date">
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setDate((d) => shiftDay(d, -1))}
                aria-label="Previous day"
                className="flex w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                {uiIcons.chevronLeft}
              </button>
              <div className="min-w-0 flex-1 md:w-44 md:flex-none">
                <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </div>
              <button
                type="button"
                onClick={() => setDate((d) => shiftDay(d, 1))}
                aria-label="Next day"
                className="flex w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                {uiIcons.chevronRight}
              </button>
              <button
                type="button"
                onClick={() => setDate(today)}
                disabled={date === today}
                className="shrink-0 rounded-md px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent"
              >
                Today
              </button>
            </div>
          </Field>
        </div>
        {selectedClass && (
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{longDate(date)}</span>
            {' · '}
            {selectedClass.course.code} · {selectedClass.batch.name}
          </p>
        )}
      </Card>

      {markError && (
        <div className="mb-4">
          <ErrorState message={markError} />
        </div>
      )}

      {!classId && !classesLoading && (
        <EmptyState
          title="No classes yet"
          description={myClassesOnly ? "You aren't assigned to any classes yet." : 'Create a class before taking attendance.'}
        />
      )}

      {loadingClassData && <LoadingState />}
      {attendanceError && (
        <div className="mb-4">
          <ErrorState message="Could not load attendance records. Refresh the page to try again." />
        </div>
      )}

      {!loadingClassData && classId && roster.length === 0 && (
        <EmptyState title="No enrolled students" description="No students are enrolled in this class's batch." />
      )}

      {!loadingClassData && roster.length > 0 && (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <SectionCard icon={uiIcons.pieChart} title="This session" meta={shortDate(date)}>
              <SessionSummary counts={dayCounts} rosterSize={roster.length} />
            </SectionCard>

            <SectionCard
              icon={uiIcons.barChart}
              title="Recent sessions"
              meta={trend.length > 0 ? `Last ${trend.length}` : undefined}
              className="lg:col-span-2"
            >
              {trend.length === 0 ? (
                <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-center">
                  <span className="mb-2 text-slate-300">{uiIcons.barChart}</span>
                  <p className="text-sm font-medium text-slate-700">No sessions recorded yet</p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Once attendance is marked, each session appears here so you can spot patterns over time.
                  </p>
                </div>
              ) : (
                <AttendanceTrendChart data={trend} selectedDate={date} onSelect={setDate} />
              )}
            </SectionCard>
          </div>

          <SectionCard
            icon={uiIcons.users}
            title="Roster"
            meta={`${roster.length} ${roster.length === 1 ? 'student' : 'students'}`}
            action={
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search students</span>
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  {uiIcons.search}
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-red-600 focus:outline-none"
                />
              </label>
            }
          >
            <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter roster by status">
              {filterChips.map((chip) => {
                const on = rosterFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRosterFilter(chip.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {chip.key !== 'ALL' && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: chip.key === 'UNMARKED' ? '#94a3b8' : STATUS_META[chip.key].color }}
                      />
                    )}
                    {chip.label}
                    <span className={`tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>{chip.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="-mx-5 overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm sm:table-auto">
                <thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Student</th>
                    <th className="hidden px-5 py-2.5 font-medium md:table-cell">Class record</th>
                    <th className="hidden px-5 py-2.5 font-medium sm:table-cell">{canMark ? 'Mark status' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRoster.map((student) => {
                    const current = attendanceByStudent.get(student.id);
                    const history = studentHistory.get(student.id);
                    const rate = history ? attendedRate(history) : null;
                    const sessions = history ? STATUS_OPTIONS.reduce((sum, s) => sum + history[s], 0) : 0;
                    const rowPending = pendingStudentId === student.id;
                    const name = `${student.user.firstName} ${student.user.lastName}`;
                    // Phones get the control full-width under the name, labelled;
                    // wider screens get it in its own column, icon-only until lg.
                    const statusCell = (stacked: boolean) =>
                      canMark ? (
                        <div
                          role="group"
                          aria-label={`Attendance for ${name}`}
                          className={`${stacked ? 'flex w-full' : 'inline-flex'} overflow-hidden rounded-md border border-slate-200`}
                        >
                          {STATUS_OPTIONS.map((status, i) => {
                            const on = current?.status === status;
                            return (
                              <button
                                key={status}
                                type="button"
                                aria-pressed={on}
                                aria-label={STATUS_META[status].label}
                                title={STATUS_META[status].label}
                                disabled={rowPending}
                                onClick={() => !on && mark.mutate({ studentId: student.id, status })}
                                className={`flex items-center justify-center gap-1.5 text-xs font-medium transition focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-60 ${
                                  stacked ? 'min-w-0 flex-1 px-1.5 py-2' : 'px-2.5 py-1.5'
                                } ${i > 0 ? 'border-l border-slate-200' : ''} ${
                                  on ? STATUS_META[status].active : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                              >
                                {statusIcons[status]}
                                <span className={stacked ? '' : 'hidden lg:inline'}>{STATUS_META[status].label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : current ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[current.status].soft}`}
                        >
                          {statusIcons[current.status]}
                          {STATUS_META[current.status].label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not marked</span>
                      );
                    return (
                      <tr key={student.id} className={`transition-colors ${rowPending ? 'bg-slate-50' : 'hover:bg-slate-50/60'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {initials(student)}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-900">{name}</div>
                              <div className="truncate text-xs text-slate-500">{student.user.email}</div>
                            </div>
                          </div>
                          <div className="mt-3 sm:hidden">{statusCell(true)}</div>
                        </td>
                        <td className="hidden px-5 py-3 md:table-cell">
                          {rate === null ? (
                            <span className="text-xs text-slate-400">No sessions yet</span>
                          ) : (
                            <div className="w-36">
                              <div className="mb-1 flex items-baseline justify-between text-xs">
                                <span
                                  className={`font-semibold tabular-nums ${rate < LOW_ATTENDANCE_PCT ? 'text-red-700' : 'text-slate-900'}`}
                                >
                                  {rate}%
                                </span>
                                <span className="tabular-nums text-slate-400">
                                  {sessions} {sessions === 1 ? 'session' : 'sessions'}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${rate < LOW_ATTENDANCE_PCT ? 'bg-red-700' : 'bg-emerald-600'}`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="hidden px-5 py-3 sm:table-cell">{statusCell(false)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleRoster.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">No students match</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try a different name, or{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setRosterFilter('ALL');
                      }}
                      className="font-medium text-red-700 underline-offset-2 hover:underline"
                    >
                      clear the filters
                    </button>
                    .
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
