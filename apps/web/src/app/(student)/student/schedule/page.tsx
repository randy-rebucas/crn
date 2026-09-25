'use client';

import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatTime, minutesOf } from '@/lib/instructor-schedule';
import { useMyEnrollments, useMyStudentProfile, pickActiveEnrollment } from '@/lib/student-hooks';
import {
  HeroFigure,
  Panel,
  PanelMessage,
  SkeletonRows,
  StudentPageHero,
  StudentShell,
  icons,
} from '@/components/student-ui';

interface ClassItem {
  id: string;
  name: string;
  batchId: string;
  status: string;
  course?: { id: string; code: string; name: string };
  room?: { name: string } | null;
  instructor?: { user: { firstName: string; lastName: string } } | null;
}

interface ScheduleItem {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface AttendanceItem {
  id: string;
  classId: string;
  date: string;
  status: 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT' | string;
}

interface Meeting {
  cls: ClassItem;
  schedule: ScheduleItem;
}

// Read-only: attendance is marked by an instructor (or QR flow), never by
// the student. No self check-in control exists on this page by design.
//
// GAP: `GET /v1/classes` has no batchId filter, so every class in the org is
// fetched and narrowed to the active batch here, then one schedules request
// fans out per class.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Monday-first week for the timetable.
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const HOUR_PX = 52;

// Course identity in the timetable: a validated categorical order, assigned
// by course (never cycled). Courses past the fourth fold into neutral.
const COURSE_TONES = [
  { block: 'bg-red-50 text-red-900 ring-red-200 hover:bg-red-100', dot: 'bg-red-700' },
  { block: 'bg-blue-50 text-blue-900 ring-blue-200 hover:bg-blue-100', dot: 'bg-blue-600' },
  { block: 'bg-teal-50 text-teal-900 ring-teal-200 hover:bg-teal-100', dot: 'bg-teal-600' },
  { block: 'bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100', dot: 'bg-amber-600' },
];
const OTHER_TONE = { block: 'bg-slate-100 text-slate-800 ring-slate-300 hover:bg-slate-200/70', dot: 'bg-slate-500' };

const ATTENDANCE_META: Record<string, { label: string; bar: string; chip: string }> = {
  PRESENT: { label: 'Present', bar: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-800' },
  LATE: { label: 'Late', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-900' },
  EXCUSED: { label: 'Excused', bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-800' },
  ABSENT: { label: 'Absent', bar: 'bg-red-600', chip: 'bg-red-50 text-red-800' },
};
const ATTENDANCE_ORDER = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'];

const glyphs = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
      <circle cx={12} cy={10} r={2.3} stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x={3.5} y={4.5} width={17} height={16} rx={2} stroke="currentColor" strokeWidth={1.7} />
      <path d="M3.5 9.5h17M9.5 9.5v11M15 9.5v11" stroke="currentColor" strokeWidth={1.7} />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <path d="m8.3 12.3 2.5 2.5 4.9-5.3" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function instructorName(cls: ClassItem) {
  const u = cls.instructor?.user;
  return u ? `${u.firstName} ${u.lastName}` : null;
}

function shortDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "8:00 AM"–"11:00 AM" → "8–11 AM" for the narrow timetable blocks.
function compactRange(start: string, end: string) {
  const a = formatTime(start).replace(':00', '');
  const b = formatTime(end).replace(':00', '');
  const [aTime, aMer] = a.split(' ');
  return aMer && b.endsWith(aMer) ? `${aTime}–${b}` : `${a}–${b}`;
}

function hoursLabel(minutes: number) {
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}

// ---------------------------------------------------------------------------
// Up next: weekly meetings projected onto the next 7 days
// ---------------------------------------------------------------------------

function UpNext({ meetings, now, toneFor }: { meetings: Meeting[]; now: Date; toneFor: (courseKey: string) => typeof OTHER_TONE }) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const items = meetings
      .filter((m) => m.schedule.dayOfWeek === date.getDay())
      .sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
    return { offset, date, items };
  });
  const nextKey = (() => {
    for (const d of days) {
      for (const m of d.items) {
        if (d.offset > 0 || minutesOf(m.schedule.startTime) > nowMin) return `${d.offset}-${m.schedule.id}`;
      }
    }
    return null;
  })();
  const visible = days.filter((d) => d.offset === 0 || d.items.length > 0);

  return (
    <Panel title="Up Next" icon={glyphs.clock}>
      <ol className="space-y-5">
        {visible.map((d) => (
          <li key={d.offset}>
            <p className="mb-2 flex items-baseline gap-2 text-sm">
              <span className={`font-semibold ${d.offset === 0 ? 'text-red-700' : 'text-slate-900'}`}>
                {d.offset === 0 ? 'Today' : d.offset === 1 ? 'Tomorrow' : DAY_NAMES[d.date.getDay()]}
              </span>
              <span className="text-xs text-slate-500">{shortDate(d.date)}</span>
            </p>
            {d.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                No classes today. A good day for a practice exam.
              </p>
            ) : (
              <ul className="space-y-2">
                {d.items.map((m) => {
                  const start = minutesOf(m.schedule.startTime);
                  const end = minutesOf(m.schedule.endTime);
                  const done = d.offset === 0 && end <= nowMin;
                  const live = d.offset === 0 && start <= nowMin && nowMin < end;
                  const next = `${d.offset}-${m.schedule.id}` === nextKey && !live;
                  const tone = toneFor(m.cls.course?.id ?? m.cls.id);
                  const teacher = instructorName(m.cls);
                  return (
                    <li
                      key={m.schedule.id}
                      className={`flex items-center gap-3 rounded-xl p-3 ${
                        live ? 'bg-red-50 ring-1 ring-red-200' : next ? 'bg-slate-50 ring-1 ring-slate-200' : ''
                      } ${done ? 'opacity-60' : ''}`}
                    >
                      <span className="w-[4.5rem] shrink-0 text-right text-xs tabular-nums">
                        <span className="block font-semibold text-slate-900">{formatTime(m.schedule.startTime)}</span>
                        <span className="block text-slate-500">{formatTime(m.schedule.endTime)}</span>
                      </span>
                      <span className={`h-9 w-1 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">{m.cls.name}</span>
                          {live && <span className="shrink-0 rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Now</span>}
                          {next && <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Next</span>}
                          {done && <span className="shrink-0 text-[11px] font-medium text-slate-500">Ended</span>}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          {m.cls.course && (
                            <span className="truncate">
                              <span className="font-semibold text-slate-700">{m.cls.course.code}</span> {m.cls.course.name}
                            </span>
                          )}
                          {m.cls.room && (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-400">{glyphs.pin}</span>
                              {m.cls.room.name}
                            </span>
                          )}
                          {teacher && (
                            <span className="inline-flex items-center gap-1 [&_svg]:h-3.5 [&_svg]:w-3.5">
                              <span className="text-slate-400">{icons.profile}</span>
                              {teacher}
                            </span>
                          )}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Weekly timetable: a time grid, one block per meeting
// ---------------------------------------------------------------------------

function Timetable({
  meetings,
  now,
  toneFor,
  courses,
}: {
  meetings: Meeting[];
  now: Date;
  toneFor: (courseKey: string) => typeof OTHER_TONE;
  courses: { key: string; code: string; name: string }[];
}) {
  const startHour = Math.floor(Math.min(...meetings.map((m) => minutesOf(m.schedule.startTime))) / 60);
  const endHour = Math.ceil(Math.max(...meetings.map((m) => minutesOf(m.schedule.endTime))) / 60);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const height = (endHour - startHour) * HOUR_PX;
  const days = WEEK.filter((d) => d !== 0 || meetings.some((m) => m.schedule.dayOfWeek === 0));
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - startHour * 60) / 60) * HOUR_PX;
  const showNow = nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const hourLabel = (h: number) => formatTime(`${String(h).padStart(2, '0')}:00`).replace(':00', '');

  return (
    <Panel title="Weekly Timetable" icon={glyphs.grid}>
      <figure>
        <figcaption className="sr-only">
          Weekly timetable:{' '}
          {days
            .map((d) => {
              const list = meetings.filter((m) => m.schedule.dayOfWeek === d);
              return list.length
                ? `${DAY_NAMES[d]}: ${list.map((m) => `${m.cls.name} ${formatTime(m.schedule.startTime)} to ${formatTime(m.schedule.endTime)}`).join(', ')}`
                : null;
            })
            .filter(Boolean)
            .join('. ')}
        </figcaption>
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:thin]" aria-hidden>
          <div className="min-w-[640px] pb-2.5">
            <div className="grid" style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }}>
              <div />
              {days.map((d) => (
                <div key={d} className="pb-2 text-center">
                  <span
                    className={`inline-flex min-w-11 justify-center rounded-full px-2 py-1 text-xs font-semibold ${
                      d === today ? 'bg-red-700 text-white' : 'text-slate-600'
                    }`}
                  >
                    {DAY_SHORT[d]}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative grid" style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))`, height }}>
              {/* Hour rules */}
              <div className="relative">
                {hours.map((h, i) => (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-slate-400"
                    style={{ top: i * HOUR_PX }}
                  >
                    {hourLabel(h)}
                  </span>
                ))}
              </div>
              {days.map((d) => (
                <div key={d} className={`relative border-l border-slate-100 ${d === today ? 'bg-red-50/40' : ''}`}>
                  {hours.slice(0, -1).map((h, i) => (
                    <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * HOUR_PX }} />
                  ))}
                  <div className="absolute inset-x-0 border-t border-slate-100" style={{ top: height }} />

                  {meetings
                    .filter((m) => m.schedule.dayOfWeek === d)
                    .map((m) => {
                      const top = ((minutesOf(m.schedule.startTime) - startHour * 60) / 60) * HOUR_PX;
                      const h = ((minutesOf(m.schedule.endTime) - minutesOf(m.schedule.startTime)) / 60) * HOUR_PX;
                      const tone = toneFor(m.cls.course?.id ?? m.cls.id);
                      return (
                        <div
                          key={m.schedule.id}
                          className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1.5 ring-1 ring-inset transition ${tone.block}`}
                          style={{ top: top + 1, height: Math.max(h - 2, 22) }}
                          title={`${m.cls.name} · ${formatTime(m.schedule.startTime)}–${formatTime(m.schedule.endTime)}`}
                        >
                          <p className="truncate text-[11px] font-bold leading-tight">{m.cls.course?.code ?? m.cls.name}</p>
                          {h >= 44 && <p className="truncate text-[10.5px] leading-tight opacity-80">{m.cls.name}</p>}
                          {h >= 64 && (
                            <p className="mt-0.5 truncate text-[10.5px] tabular-nums leading-tight opacity-80">
                              {compactRange(m.schedule.startTime, m.schedule.endTime)}
                            </p>
                          )}
                          {h >= 84 && m.cls.room && <p className="truncate text-[10.5px] leading-tight opacity-80">{m.cls.room.name}</p>}
                        </div>
                      );
                    })}

                  {d === today && showNow && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                      <span className="-ml-1 h-2 w-2 rounded-full bg-red-600" />
                      <span className="h-0.5 flex-1 bg-red-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400 md:hidden">Swipe sideways to see the whole week.</p>
        {courses.length > 0 && (
          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {courses.map((c) => (
              <li key={c.key} className="inline-flex min-w-0 items-center gap-1.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${toneFor(c.key).dot}`} aria-hidden />
                <span className="font-semibold text-slate-800">{c.code}</span>
                <span className="truncate">{c.name}</span>
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="h-0.5 w-4 rounded bg-red-600" aria-hidden /> Now
            </li>
          </ul>
        )}
      </figure>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

function AttendanceSummary({ records, classById }: { records: AttendanceItem[]; classById: Map<string, ClassItem> }) {
  const total = records.length;
  const counts = Object.fromEntries(ATTENDANCE_ORDER.map((s) => [s, records.filter((r) => r.status === s).length])) as Record<string, number>;

  const perClass = [...classById.values()]
    .map((cls) => {
      const mine = records.filter((r) => r.classId === cls.id);
      const attended = mine.filter((r) => r.status === 'PRESENT').length;
      return { cls, held: mine.length, pct: mine.length ? Math.round((attended / mine.length) * 100) : null };
    })
    .filter((c) => c.held > 0)
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));

  return (
    <Panel title="Attendance" icon={glyphs.check}>
      {total === 0 ? (
        <PanelMessage>Attendance appears here once your instructors start marking classes.</PanelMessage>
      ) : (
        <>
          <div
            className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`${total} records: ${ATTENDANCE_ORDER.map((s) => `${counts[s]} ${ATTENDANCE_META[s].label.toLowerCase()}`).join(', ')}`}
          >
            {ATTENDANCE_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} className={`h-full ${ATTENDANCE_META[s].bar}`} style={{ flexGrow: counts[s] }} />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {ATTENDANCE_ORDER.map((s) => (
              <div key={s} className="flex flex-col-reverse rounded-lg bg-slate-50 px-1 py-2">
                <dt className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                  <span className={`h-2 w-2 rounded-sm ${ATTENDANCE_META[s].bar}`} aria-hidden />
                  {ATTENDANCE_META[s].label}
                </dt>
                <dd className="text-lg font-bold tabular-nums text-slate-900">{counts[s]}</dd>
              </div>
            ))}
          </dl>

          {perClass.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold text-slate-700">By class</p>
              <ul className="space-y-3">
                {perClass.map(({ cls, held, pct }) => (
                  <li key={cls.id}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-700">{cls.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        <span className="font-bold text-slate-900">{pct}%</span> of {held}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden>
                      <div
                        className="h-full rounded-full bg-red-700"
                        style={{ width: `${Math.max(pct ?? 0, 2)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate-400">Share of recorded sessions marked present — the same figure your instructors see.</p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function AttendanceHistory({ records, classById }: { records: AttendanceItem[]; classById: Map<string, ClassItem> }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = records.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const shown = expanded ? sorted : sorted.slice(0, 6);

  return (
    <Panel title="Attendance History" icon={icons.schedule}>
      {sorted.length === 0 ? (
        <PanelMessage>No attendance records yet.</PanelMessage>
      ) : (
        <>
          <ul className="-mx-2 divide-y divide-slate-100">
            {shown.map((a) => {
              const meta = ATTENDANCE_META[a.status] ?? { label: a.status, chip: 'bg-slate-100 text-slate-700' };
              const date = new Date(a.date);
              return (
                <li key={a.id} className="flex items-center gap-3 px-2 py-2.5">
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50 leading-none">
                    <span className="text-[10px] font-semibold uppercase text-slate-500">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-sm font-bold tabular-nums text-slate-900">{date.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{classById.get(a.classId)?.name ?? 'Class'}</span>
                    <span className="block text-xs text-slate-500">{DAY_NAMES[date.getDay()]}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.chip}`}>{meta.label}</span>
                </li>
              );
            })}
          </ul>
          {sorted.length > 6 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              {expanded ? 'Show fewer' : `Show all ${sorted.length} records`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Module-level so useQueries can memoize the combined result between renders.
function combineSchedules(results: { data?: ScheduleItem[]; isLoading: boolean }[]) {
  return { data: results.map((r) => r.data), loading: results.some((r) => r.isLoading) };
}

export default function StudentSchedulePage() {
  const [now] = useState(() => new Date());
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
  const active = pickActiveEnrollment(enrollments.data);

  const classesQuery = useQuery<ClassItem[]>({
    queryKey: ['classes-for-batch', active?.batchId],
    enabled: Boolean(active?.batchId),
    queryFn: async () => {
      const { data } = await apiClient.get<ClassItem[]>('/v1/classes');
      return data.filter((c) => c.batchId === active!.batchId && c.status !== 'CANCELLED');
    },
  });

  const schedules = useQueries({
    queries: (classesQuery.data ?? []).map((cls) => ({
      queryKey: ['schedules-for-class', cls.id],
      queryFn: async () => (await apiClient.get<ScheduleItem[]>('/v1/schedules', { params: { classId: cls.id } })).data,
      enabled: Boolean(classesQuery.data),
    })),
    combine: combineSchedules,
  });

  // GET /v1/attendance?studentId= requires `attendance.view`; studentId here
  // is the StudentProfile id (not the User id).
  const attendanceQuery = useQuery<AttendanceItem[]>({
    queryKey: ['my-attendance', profile.data?.id],
    enabled: Boolean(profile.data),
    retry: false,
    queryFn: async () =>
      (await apiClient.get<AttendanceItem[]>('/v1/attendance', { params: { studentId: profile.data!.id } })).data,
  });

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const schedulesLoading = schedules.loading;
  const meetings = useMemo<Meeting[]>(
    () => classes.flatMap((cls, idx) => (schedules.data[idx] ?? []).map((schedule) => ({ cls, schedule }))),
    [classes, schedules.data],
  );

  // One color per course, in course-code order.
  const courses = useMemo(() => {
    const seen = new Map<string, { key: string; code: string; name: string }>();
    for (const m of meetings) {
      const key = m.cls.course?.id ?? m.cls.id;
      if (!seen.has(key)) seen.set(key, { key, code: m.cls.course?.code ?? m.cls.name, name: m.cls.course?.name ?? '' });
    }
    return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [meetings]);
  const toneFor = (key: string) => {
    const i = courses.findIndex((c) => c.key === key);
    return i >= 0 && i < COURSE_TONES.length ? COURSE_TONES[i] : OTHER_TONE;
  };

  const weeklyMinutes = meetings.reduce((s, m) => s + minutesOf(m.schedule.endTime) - minutesOf(m.schedule.startTime), 0);
  const nextMeeting = (() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (let offset = 0; offset < 7; offset++) {
      const dow = (now.getDay() + offset) % 7;
      const hit = meetings
        .filter((m) => m.schedule.dayOfWeek === dow && (offset > 0 || minutesOf(m.schedule.startTime) > nowMin))
        .sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))[0];
      if (hit) return { m: hit, offset };
    }
    return null;
  })();
  const records = attendanceQuery.data ?? [];
  // Same rule as GET /v1/progress/me (and the staff views): sessions marked
  // present over every recorded session.
  const attendanceRate = records.length
    ? Math.round((records.filter((r) => r.status === 'PRESENT').length / records.length) * 100)
    : null;

  const isLoading = profile.isLoading || enrollments.isLoading || (Boolean(active?.batchId) && classesQuery.isLoading);
  const dash = <span className="text-slate-300">—</span>;
  const batch = active?.batch;

  return (
    <StudentShell>
      <StudentPageHero
        badge={icons.schedule}
        title="Schedule"
        meta={
          batch ? (
            <>
              <span className="font-semibold text-slate-700">{batch.name}</span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span>
                {shortDate(batch.startDate)}
                {batch.endDate ? ` – ${new Date(batch.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ' onward'}
              </span>
            </>
          ) : (
            <span>Your weekly class schedule and attendance history.</span>
          )
        }
      >
        <HeroFigure icon={icons.learn} tone="bg-red-50 text-red-700" value={isLoading ? dash : classes.length} label={classes.length === 1 ? 'Class' : 'Classes'} />
        <HeroFigure
          icon={glyphs.clock}
          tone="bg-blue-50 text-blue-700"
          value={isLoading || schedulesLoading ? dash : hoursLabel(weeklyMinutes)}
          label="Hours per week"
        />
        <HeroFigure
          icon={icons.schedule}
          tone="bg-amber-50 text-amber-700"
          value={
            nextMeeting
              ? `${nextMeeting.offset === 0 ? 'Today' : nextMeeting.offset === 1 ? 'Tmrw' : DAY_SHORT[nextMeeting.m.schedule.dayOfWeek]} ${formatTime(nextMeeting.m.schedule.startTime)}`
              : dash
          }
          label="Next class"
        />
        <HeroFigure
          icon={glyphs.check}
          tone="bg-emerald-50 text-emerald-700"
          value={attendanceRate === null ? dash : `${attendanceRate}%`}
          label={attendanceQuery.isError ? 'Attendance unavailable' : 'Attendance (present)'}
        />
      </StudentPageHero>

      {isLoading && <SkeletonRows count={3} className="h-24" />}
      {enrollments.isError && <PanelMessage tone="error">Couldn&apos;t load your enrollment. Refresh the page to try again.</PanelMessage>}
      {!isLoading && !enrollments.isError && !active && (
        <PanelMessage>
          <span className="text-slate-400 [&_svg]:h-8 [&_svg]:w-8">{icons.schedule}</span>
          <span className="font-semibold text-slate-700">No active enrollment</span>
          <span>Your schedule appears here once you&apos;re enrolled and assigned a batch.</span>
        </PanelMessage>
      )}
      {!isLoading && active && !active.batchId && (
        <PanelMessage>
          <span className="font-semibold text-slate-700">Not assigned to a batch yet</span>
          <span>Your classes appear here once the center places you in a batch.</span>
        </PanelMessage>
      )}
      {classesQuery.isError && <PanelMessage tone="error">Couldn&apos;t load your classes. Refresh the page to try again.</PanelMessage>}
      {!isLoading && active?.batchId && classesQuery.data && classes.length === 0 && (
        <PanelMessage>
          <span className="font-semibold text-slate-700">No classes yet</span>
          <span>No classes have been scheduled for your batch yet.</span>
        </PanelMessage>
      )}

      {!isLoading && classes.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="grid min-w-0 gap-5">
            {schedulesLoading ? (
              <SkeletonRows count={2} className="h-48" />
            ) : meetings.length === 0 ? (
              <PanelMessage>Your classes don&apos;t have meeting times yet.</PanelMessage>
            ) : (
              <>
                <UpNext meetings={meetings} now={now} toneFor={toneFor} />
                <Timetable meetings={meetings} now={now} toneFor={toneFor} courses={courses} />
              </>
            )}
          </div>

          <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1" aria-label="Attendance">
            {attendanceQuery.isLoading ? (
              <SkeletonRows count={2} className="h-40" />
            ) : attendanceQuery.isError ? (
              <PanelMessage>
                <span className="font-semibold text-slate-700">Attendance isn&apos;t available</span>
                <span>Your account can&apos;t view attendance records yet. Ask the center if you need your attendance history.</span>
              </PanelMessage>
            ) : (
              <>
                <AttendanceSummary records={records} classById={classById} />
                <AttendanceHistory records={records} classById={classById} />
              </>
            )}
          </aside>
        </div>
      )}
    </StudentShell>
  );
}
