'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';

interface ClassRecord {
  id: string;
  name: string;
  status?: string;
  course: { name: string; code: string };
  batch: { name: string };
  room?: { name: string; capacity: number | null } | null;
  instructor?: { user: { firstName: string; lastName: string } } | null;
}

interface Schedule {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** Summary of the class, included on the org-wide listing. */
  class?: ClassRecord;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Review weeks run Monday-first; Sunday sits at the end.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// One hue per class, stable by its position in the class list. Tinted fills
// keep dense timetables readable; the solid value drives dots and chart bars.
const CLASS_HUES = ['#b91c1c', '#d97706', '#2563eb', '#059669', '#7c3aed', '#475569', '#db2777', '#0d9488'];

const HOUR_PX = 44;

const icons = {
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x={4} y={5.5} width={16} height={15} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M4 9.5h16M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={12} cy={12} r={8} stroke="currentColor" strokeWidth={1.7} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="m12 3.5 8 4.3-8 4.3-8-4.3 8-4.3Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="m4 12.3 8 4.3 8-4.3M4 16.3l8 4.3 8-4.3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  barChart: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <circle cx={12} cy={9.5} r={2.4} stroke="currentColor" strokeWidth={1.8} />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <circle cx={12} cy={8} r={3.3} stroke="currentColor" strokeWidth={1.8} />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  ),
};

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatRange(start: string, end: string) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

function instructorName(cls: ClassRecord) {
  return cls.instructor ? `${cls.instructor.user.firstName} ${cls.instructor.user.lastName}` : null;
}

// Section names share a course prefix ("NCLEX Review - Section A"), which is
// all a narrow timetable block would show — keep the distinguishing tail.
function shortName(cls: ClassRecord) {
  const parts = cls.name.split(/\s[-–—]\s/);
  return parts.length > 1 ? parts[parts.length - 1] : cls.name;
}

function classLabel(cls: ClassRecord) {
  return `${cls.name} — ${cls.course.name} (${cls.batch.name})`;
}

interface Session extends Schedule {
  cls: ClassRecord;
  color: string;
  start: number;
  end: number;
}

// Greedy lane packing so two classes meeting at the same hour (in different
// rooms) sit side by side instead of drawing over each other.
function layoutDay(sessions: Session[]) {
  const sorted = [...sessions].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const placed = sorted.map((s) => {
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.end);
    } else {
      laneEnds[lane] = s.end;
    }
    return { session: s, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const createScheduleSchema = z
  .object({
    classId: z.string().min(1, 'Choose a class'),
    dayOfWeek: z.string().min(1, 'Choose a day'),
    startTime: z.string().regex(timePattern, 'Enter a start time'),
    endTime: z.string().regex(timePattern, 'Enter an end time'),
  })
  .refine((v) => v.startTime < v.endTime, { path: ['endTime'], message: 'End time must be after the start time' });
type CreateScheduleValues = z.infer<typeof createScheduleSchema>;

function CreateScheduleForm({
  classes,
  defaultClassId,
  onCreated,
}: {
  classes: ClassRecord[];
  defaultClassId?: string;
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
  } = useForm<CreateScheduleValues>({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: { classId: defaultClassId ?? '', dayOfWeek: '', startTime: '', endTime: '' },
  });

  const [classId, dayOfWeek, startTime, endTime] = useWatch({
    control,
    name: ['classId', 'dayOfWeek', 'startTime', 'endTime'],
  });
  const selected = classes.find((c) => c.id === classId);
  const duration =
    timePattern.test(startTime ?? '') && timePattern.test(endTime ?? '') && startTime < endTime
      ? toMinutes(endTime) - toMinutes(startTime)
      : null;

  const onSubmit = async (values: CreateScheduleValues) => {
    setServerError(null);
    try {
      await apiClient.post('/v1/schedules', {
        classId: values.classId,
        dayOfWeek: Number(values.dayOfWeek),
        startTime: values.startTime,
        endTime: values.endTime,
      });
      reset();
      onCreated();
    } catch (err) {
      // Room/instructor conflicts come back as 400s with a descriptive message
      // from SchedulesService — surface it verbatim rather than re-deriving it.
      setServerError(errorMessage(err, 'Could not create the schedule. Check your connection and try again.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field label="Class" error={errors.classId?.message}>
        <Select {...register('classId')}>
          <option value="" disabled>
            Select class…
          </option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {classLabel(cls)}
            </option>
          ))}
        </Select>
      </Field>

      {selected && (
        <div className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            {icons.pin}
            {selected.room?.name ?? 'No room assigned'}
          </span>
          <span className="flex items-center gap-1.5">
            {icons.person}
            {instructorName(selected) ?? 'No instructor assigned'}
          </span>
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Day of week</span>
        <input type="hidden" {...register('dayOfWeek')} />
        <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Day of week">
          {WEEK_ORDER.map((day) => {
            const on = dayOfWeek === String(day);
            return (
              <button
                key={day}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={DAY_LABELS[day]}
                onClick={() => setValue('dayOfWeek', String(day), { shouldValidate: true })}
                className={`rounded-md border py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                  on ? 'border-red-700 bg-red-700 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {DAY_SHORT[day]}
              </button>
            );
          })}
        </div>
        {errors.dayOfWeek?.message && <p className="mt-1 text-xs text-red-600">{errors.dayOfWeek.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" error={errors.startTime?.message}>
          <Input type="time" {...register('startTime')} />
        </Field>
        <Field label="End time" error={errors.endTime?.message}>
          <Input type="time" {...register('endTime')} />
        </Field>
      </div>

      {duration !== null && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          {icons.clock}
          {formatHours(duration)} session{dayOfWeek !== '' && `, every ${DAY_LABELS[Number(dayOfWeek)]}`}
        </p>
      )}

      <p className="text-xs text-slate-500">
        Saving checks this time against the class&apos;s room and instructor, so nothing is double-booked.
      </p>

      {serverError && <ErrorState message={serverError} />}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Add meeting time'}
        </Button>
      </div>
    </form>
  );
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

function WeekGrid({
  sessions,
  focusId,
  onFocus,
  now,
}: {
  sessions: Session[];
  focusId: string | null;
  onFocus: (id: string | null) => void;
  now: Date;
}) {
  const firstHour = Math.min(8, ...sessions.map((s) => Math.floor(s.start / 60)));
  const lastHour = Math.max(17, ...sessions.map((s) => Math.ceil(s.end / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const height = hours.length * HOUR_PX;
  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60;

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <div className="grid min-w-[760px] grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        <div />
        {WEEK_ORDER.map((day) => (
          <div
            key={day}
            className={`pb-2 text-center text-xs font-medium ${day === today ? 'text-red-700' : 'text-slate-500'}`}
          >
            {DAY_SHORT[day]}
            {day === today && <span className="ml-1 rounded bg-red-50 px-1 py-px text-[11px]">Today</span>}
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 text-[11px] tabular-nums text-slate-400"
              style={{ top: i * HOUR_PX, transform: i === 0 ? undefined : 'translateY(-50%)' }}
            >
              {hourLabel(h)}
            </div>
          ))}
        </div>

        {WEEK_ORDER.map((day) => {
          const { placed, lanes } = layoutDay(sessions.filter((s) => s.dayOfWeek === day));
          return (
            <div
              key={day}
              className={`relative border-l border-slate-100 ${day === today ? 'bg-red-50/40' : ''}`}
              style={{ height }}
            >
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * HOUR_PX }} />
              ))}
              {day === today && showNow && (
                <div
                  className="absolute inset-x-0 z-20 flex items-center"
                  style={{ top: ((nowMinutes - firstHour * 60) / 60) * HOUR_PX }}
                  aria-hidden
                >
                  <span className="-ml-1 h-2 w-2 rounded-full bg-red-600" />
                  <span className="h-px flex-1 bg-red-600" />
                </div>
              )}
              {placed.map(({ session, lane }) => {
                const dimmed = focusId !== null && focusId !== session.classId;
                const top = ((session.start - firstHour * 60) / 60) * HOUR_PX;
                const blockHeight = Math.max(22, ((session.end - session.start) / 60) * HOUR_PX - 3);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onFocus(focusId === session.classId ? null : session.classId)}
                    title={`${session.cls.name} · ${formatRange(session.startTime, session.endTime)}${
                      session.cls.room ? ` · ${session.cls.room.name}` : ''
                    }`}
                    className={`absolute z-10 overflow-hidden rounded-md px-2 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-600 ${
                      dimmed ? 'opacity-30' : 'hover:brightness-95'
                    }`}
                    style={{
                      top: top + 1.5,
                      height: blockHeight,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                      backgroundColor: `${session.color}1f`,
                      color: session.color,
                    }}
                  >
                    <div className="truncate text-xs font-semibold leading-tight">{shortName(session.cls)}</div>
                    <div className="truncate text-[11px] leading-tight text-slate-600">
                      {formatRange(session.startTime, session.endTime)}
                    </div>
                    {session.cls.room && blockHeight > 64 && (
                      <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                        {icons.pin}
                        <span className="truncate">{session.cls.room.name}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayAgenda({ sessions, now }: { sessions: Session[]; now: Date }) {
  const today = now.getDay();
  return (
    <ol className="space-y-4">
      {WEEK_ORDER.map((day) => {
        const daySessions = sessions.filter((s) => s.dayOfWeek === day).sort((a, b) => a.start - b.start);
        return (
          <li key={day}>
            <div className={`mb-1.5 text-xs font-semibold ${day === today ? 'text-red-700' : 'text-slate-500'}`}>
              {DAY_LABELS[day]}
              {day === today && ' · Today'}
            </div>
            {daySessions.length === 0 ? (
              <p className="text-xs text-slate-400">No classes</p>
            ) : (
              <ul className="space-y-1.5">
                {daySessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2"
                    style={{ backgroundColor: `${s.color}14` }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{s.cls.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {formatRange(s.startTime, s.endTime)}
                        {s.cls.room && ` · ${s.cls.room.name}`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function HoursByDayChart({ sessions, classes }: { sessions: Session[]; classes: { cls: ClassRecord; color: string }[] }) {
  const data = WEEK_ORDER.map((day) => {
    const row: Record<string, number | string> = { day: DAY_SHORT[day] };
    for (const { cls } of classes) row[cls.id] = 0;
    for (const s of sessions.filter((x) => x.dayOfWeek === day)) {
      row[s.classId] = Number(row[s.classId]) + (s.end - s.start) / 60;
    }
    return row;
  });
  const names = new Map(classes.map(({ cls }) => [cls.id, cls.name]));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
          unit="h"
        />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
          formatter={(value, key) => [`${value} h`, names.get(String(key)) ?? String(key)]}
        />
        {classes.map(({ cls, color }, i) => (
          <Bar
            key={cls.id}
            dataKey={cls.id}
            stackId="h"
            fill={color}
            radius={i === classes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function SchedulesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerClassId, setDrawerClassId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keep the "now" line honest if the page stays open.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const canCreate = hasPermission('schedules.create');
  const canClasses = hasPermission('classes.view');

  // The whole week in one request; each row carries its class summary.
  const schedulesQuery = useQuery<Schedule[]>({
    queryKey: ['schedules', 'all'],
    queryFn: async () => (await apiClient.get('/v1/schedules')).data,
  });
  const schedulesLoading = schedulesQuery.isLoading;
  const schedulesError = schedulesQuery.isError;

  // The class list (so unscheduled classes show too) needs classes.view.
  // Without it, the classes are the ones that appear on the timetable.
  const classesQuery = useQuery<ClassRecord[]>({
    queryKey: ['classes'],
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
    enabled: canClasses,
  });
  const classes: ClassRecord[] = canClasses
    ? (classesQuery.data ?? [])
    : [
        ...new Map(
          (schedulesQuery.data ?? []).flatMap((s) => (s.class ? [[s.class.id, s.class] as const] : [])),
        ).values(),
      ];
  const classesLoading = canClasses ? classesQuery.isLoading : schedulesLoading;
  const classesError = canClasses ? classesQuery.isError : schedulesError;

  const classColors = classes.map((cls, i) => ({ cls, color: CLASS_HUES[i % CLASS_HUES.length] }));
  const colorOf = new Map(classColors.map(({ cls, color }) => [cls.id, { cls, color }]));

  // A week of meeting times is a few dozen rows at most — cheap enough to
  // derive every render.
  const sessions: Session[] = (schedulesQuery.data ?? []).flatMap((s) => {
    const entry = colorOf.get(s.classId);
    if (!entry) return [];
    return [{ ...s, cls: entry.cls, color: entry.color, start: toMinutes(s.startTime), end: toMinutes(s.endTime) }];
  });

  const sessionsByClass = new Map<string, Session[]>();
  for (const s of sessions) sessionsByClass.set(s.classId, [...(sessionsByClass.get(s.classId) ?? []), s]);
  for (const list of sessionsByClass.values()) {
    list.sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek) || a.start - b.start);
  }

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.end - s.start), 0);
  const scheduledClasses = sessionsByClass.size;
  const busiest = WEEK_ORDER.map((day) => ({
    day,
    minutes: sessions.filter((s) => s.dayOfWeek === day).reduce((sum, s) => sum + (s.end - s.start), 0),
  })).sort((a, b) => b.minutes - a.minutes)[0];

  const openForm = (classId?: string) => {
    setDrawerClassId(classId ?? focusId ?? classes[0]?.id ?? null);
    setShowForm(true);
  };

  const focusedClass = classes.find((c) => c.id === focusId);

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Weekly meeting times for each class, with room and instructor conflict checks."
        action={
          canCreate &&
          canClasses &&
          classes.length > 0 && (
            <Button onClick={() => openForm()} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {icons.plus}
              New schedule
            </Button>
          )
        }
      />

      <Drawer open={showForm} onClose={() => setShowForm(false)} title="Add meeting time">
        <CreateScheduleForm
          key={drawerClassId ?? 'none'}
          classes={classes}
          defaultClassId={drawerClassId ?? undefined}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
          }}
        />
      </Drawer>

      {classesLoading && <LoadingState />}
      {classesError && <ErrorState message="Could not load classes. Refresh the page to try again." />}

      {!classesLoading && !classesError && classes.length === 0 && (
        <EmptyState title="No classes yet" description="Create a class before scheduling meeting times." />
      )}

      {classes.length > 0 && (
        <>
          <Card className="mb-6 grid grid-cols-2 divide-slate-100 lg:grid-cols-4 lg:divide-x">
            {[
              { icon: icons.layers, label: 'Classes scheduled', value: `${scheduledClasses} of ${classes.length}` },
              { icon: icons.calendar, label: 'Sessions per week', value: sessions.length },
              { icon: icons.clock, label: 'Contact hours per week', value: formatHours(totalMinutes) },
              {
                icon: icons.barChart,
                label: 'Busiest day',
                value: busiest && busiest.minutes > 0 ? DAY_LABELS[busiest.day] : '—',
                sub: busiest && busiest.minutes > 0 ? formatHours(busiest.minutes) : undefined,
              },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 p-4 sm:p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  {stat.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold tabular-nums text-slate-900 sm:text-lg">
                    {schedulesLoading ? '…' : stat.value}
                    {stat.sub && !schedulesLoading && (
                      <span className="ml-1.5 text-xs font-medium text-slate-400">{stat.sub}</span>
                    )}
                  </div>
                  <div className="text-xs leading-snug text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </Card>

          {schedulesError && (
            <div className="mb-4">
              <ErrorState message="Some schedules could not be loaded, so the week below may be incomplete. Refresh to try again." />
            </div>
          )}

          <SectionCard
            icon={icons.calendar}
            title="Week at a glance"
            meta={focusedClass ? `Showing ${focusedClass.name}` : 'All classes'}
            className="mb-6"
            action={
              focusedClass && (
                <button
                  type="button"
                  onClick={() => setFocusId(null)}
                  className="text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                >
                  Show all classes
                </button>
              )
            }
          >
            {schedulesLoading ? (
              <LoadingState />
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-14 text-center">
                <span className="mb-2 text-slate-300">{icons.calendar}</span>
                <p className="text-sm font-medium text-slate-700">No meeting times yet</p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  Add a weekly time for a class and it appears on this timetable.
                </p>
                {canCreate && (
                  <Button className="mt-4" onClick={() => openForm()}>
                    Add the first meeting time
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <WeekGrid sessions={sessions} focusId={focusId} onFocus={setFocusId} now={now} />
                </div>
                <div className="md:hidden">
                  <DayAgenda sessions={focusId ? sessions.filter((s) => s.classId === focusId) : sessions} now={now} />
                </div>
              </>
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-5">
            <SectionCard
              icon={icons.layers}
              title="Classes"
              meta={`${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}
              className="lg:col-span-3"
            >
              <ul className="-mx-5 divide-y divide-slate-100 border-t border-slate-100">
                {classColors.map(({ cls, color }) => {
                  const list = sessionsByClass.get(cls.id) ?? [];
                  const minutes = list.reduce((sum, s) => sum + (s.end - s.start), 0);
                  const focused = focusId === cls.id;
                  return (
                    <li key={cls.id} className={`px-5 py-4 transition-colors ${focused ? 'bg-slate-50' : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setFocusId(focused ? null : cls.id)}
                          aria-pressed={focused}
                          className="flex min-w-0 items-start gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                        >
                          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-900 hover:text-red-700">
                              {cls.name}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {cls.course.code} · {cls.batch.name}
                            </span>
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          {cls.status && <StatusBadge status={cls.status} />}
                          {canCreate && (
                            <Button variant="secondary" className="flex items-center gap-1 !px-2 !py-1 text-xs" onClick={() => openForm(cls.id)}>
                              {icons.plus}
                              Add time
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-5 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          {icons.pin}
                          {cls.room ? cls.room.name : 'No room'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {icons.person}
                          {instructorName(cls) ?? 'No instructor'}
                        </span>
                        {minutes > 0 && (
                          <span className="flex items-center gap-1.5">
                            {icons.clock}
                            {formatHours(minutes)} / week
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-5">
                        {list.length === 0 ? (
                          <span className="text-xs text-slate-400">No meeting times yet</span>
                        ) : (
                          list.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                            >
                              <span className="font-semibold">{DAY_SHORT[s.dayOfWeek]}</span>
                              <span className="tabular-nums text-slate-500">{formatRange(s.startTime, s.endTime)}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>

            <SectionCard icon={icons.barChart} title="Hours by day" meta="Per class, weekly" className="lg:col-span-2">
              {schedulesLoading ? (
                <LoadingState />
              ) : sessions.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">No meeting times to chart yet.</p>
              ) : (
                <>
                  <HoursByDayChart sessions={sessions} classes={classColors} />
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {classColors.map(({ cls, color }) => {
                      const minutes = (sessionsByClass.get(cls.id) ?? []).reduce((sum, s) => sum + (s.end - s.start), 0);
                      return (
                        <li key={cls.id} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-slate-600">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                            <span className="truncate">{cls.name}</span>
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-slate-900">{formatHours(minutes)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
