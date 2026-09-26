'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  type AttendanceRecord,
  type InstructorClass,
  type RosterStudent,
  type Schedule,
  useCanTakeAttendance,
  useMyAttendance,
  useMyClasses,
  useMyRosters,
  useMySchedules,
  useNow,
} from '@/lib/instructor-hooks';
import {
  WEEKDAYS,
  attendanceRate,
  dayKey,
  formatTime,
  nextOccurrence,
  recordDayKey,
  relativeDay,
} from '@/lib/instructor-schedule';
import { Drawer, StatusBadge } from '@/components/ui';
import { instructorIcons as icons } from '@/components/instructor-ui';

// One card per class the instructor teaches: its weekly rhythm, the next
// session, roster size and recent attendance — everything needed to decide
// where to go next (take attendance, open the roster) without a table scan.

const TONES = [
  { bar: 'bg-red-600', day: 'bg-red-600 text-white', soft: 'bg-red-50 text-red-700' },
  { bar: 'bg-amber-400', day: 'bg-amber-400 text-amber-950', soft: 'bg-amber-50 text-amber-700' },
  { bar: 'bg-blue-600', day: 'bg-blue-600 text-white', soft: 'bg-blue-50 text-blue-700' },
] as const;
type Tone = (typeof TONES)[number];

const STATUS_ORDER = ['ACTIVE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function rateMeter(rate: number | null) {
  if (rate === null) return 'bg-slate-200';
  if (rate >= 90) return 'bg-emerald-600';
  if (rate >= 75) return 'bg-amber-500';
  return 'bg-red-600';
}

function rateTone(rate: number | null) {
  if (rate === null) return 'text-slate-500';
  if (rate >= 90) return 'text-emerald-700';
  if (rate >= 75) return 'text-amber-700';
  return 'text-red-700';
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function WeekStrip({ schedules, tone, today }: { schedules: Schedule[]; tone: Tone; today: number }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Weekly schedule">
      {WEEKDAYS.map((label, day) => {
        const slots = schedules.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const has = slots.length > 0;
        const times = slots.map((s) => `${formatTime(s.startTime)}–${formatTime(s.endTime)}`).join(', ');
        const description = `${label}${day === today ? ' (today)' : ''}: ${has ? times : 'no session'}`;
        return (
          <li
            key={label}
            title={description}
            className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-[11px] font-semibold ${
              has ? tone.day : day === today ? 'bg-white text-slate-900 shadow-sm' : 'bg-slate-50 text-slate-400'
            }`}
          >
            <span aria-hidden>{label.charAt(0)}</span>
            <span className="sr-only">{description}</span>
            {day === today && (
              <span className={`absolute bottom-1 h-1 w-1 rounded-full ${has ? 'bg-current' : 'bg-red-600'}`} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold leading-tight tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded bg-slate-200 ${className}`} aria-hidden />;
}

function ClassCard({
  cls,
  tone,
  schedules,
  schedulesLoading,
  roster,
  rosterLoading,
  rosterEnabled,
  records,
  attendanceLoading,
  now,
  onOpenRoster,
}: {
  cls: InstructorClass;
  tone: Tone;
  schedules: Schedule[];
  schedulesLoading: boolean;
  roster: RosterStudent[] | undefined;
  rosterLoading: boolean;
  rosterEnabled: boolean;
  records: AttendanceRecord[];
  attendanceLoading: boolean;
  now: Date;
  onOpenRoster: () => void;
}) {
  const { hasPermission } = useAuth();
  const canMark = useCanTakeAttendance() && hasPermission('attendance.create');
  const next = nextOccurrence(schedules, now);
  const since = now.getTime() - 30 * 86_400_000;
  const recent = records.filter((r) => new Date(r.date).getTime() >= since);
  const rate = attendanceRate(recent);
  const sessionsMarked = new Set(records.map(recordDayKey)).size;
  const markedToday = records.some((r) => recordDayKey(r) === dayKey(now));

  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <span className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} aria-hidden />

      <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-6">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-wide text-slate-900">{cls.name}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {cls.course.name} <span className="text-slate-400">·</span>{' '}
            <span className="font-medium tabular-nums text-slate-500">{cls.course.code}</span>
          </p>
        </div>
        <StatusBadge status={cls.status} />
      </header>

      <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icons.layers}</span>
          {cls.batch.name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icons.mapPin}</span>
          {cls.room?.name ?? 'No room assigned'}
        </span>
      </div>

      <section className="mx-5 mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
        {schedulesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <WeekStrip schedules={schedules} tone={tone} today={now.getDay()} />
            <p className="mt-3 flex items-center gap-2 text-sm">
              <span className={`[&_svg]:h-4 [&_svg]:w-4 ${next?.live ? 'text-red-600' : 'text-slate-400'}`}>{icons.clock}</span>
              {!next && <span className="text-slate-500">No weekly sessions scheduled yet</span>}
              {next?.live && (
                <span className="text-slate-700">
                  <span className="font-semibold text-red-700">In session now</span> · until {formatTime(next.schedule.endTime)}
                </span>
              )}
              {next && !next.live && (
                <span className="text-slate-700">
                  <span className="font-semibold text-slate-900">Next: {relativeDay(next.date, now)}</span> ·{' '}
                  <span className="tabular-nums">
                    {formatTime(next.schedule.startTime)} – {formatTime(next.schedule.endTime)}
                  </span>
                </span>
              )}
            </p>
          </>
        )}
      </section>

      <dl className="grid grid-cols-3 gap-4 px-5 py-4">
        <Stat label="Students">
          {!rosterEnabled ? '—' : rosterLoading ? <Skeleton className="h-6 w-8" /> : (roster?.length ?? '—')}
        </Stat>
        <Stat label="Attendance, 30d">
          {attendanceLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <>
              <span className={rateTone(rate)}>{rate === null ? '—' : `${rate}%`}</span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <span className={`block h-full rounded-full ${rateMeter(rate)}`} style={{ width: `${rate ?? 0}%` }} />
              </span>
            </>
          )}
        </Stat>
        <Stat label="Sessions marked">
          {attendanceLoading ? <Skeleton className="h-6 w-8" /> : sessionsMarked}
        </Stat>
      </dl>

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3.5">
        {canMark && (
          <Link
            href={`/instructor/attendance?classId=${cls.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            <span className="[&_svg]:h-4 [&_svg]:w-4">{icons.checkSquare}</span>
            {markedToday ? 'Review today’s attendance' : 'Take attendance'}
          </Link>
        )}
        {rosterEnabled && (
          <button
            type="button"
            onClick={onOpenRoster}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            <span className="text-slate-500 [&_svg]:h-4 [&_svg]:w-4">{icons.users}</span>
            View roster
          </button>
        )}
      </footer>
    </article>
  );
}

function RosterDrawer({
  open,
  cls,
  roster,
  records,
  onClose,
}: {
  open: boolean;
  cls: InstructorClass | null;
  roster: RosterStudent[] | undefined;
  records: AttendanceRecord[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (roster ?? [])
      .map((student) => {
        const mine = records.filter((r) => r.studentId === student.id);
        const attended = mine.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        return { student, attended, total: mine.length, rate: attendanceRate(mine) };
      })
      .filter(({ student }) =>
        q ? `${student.user.firstName} ${student.user.lastName} ${student.user.email}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => a.student.user.lastName.localeCompare(b.student.user.lastName));
  }, [roster, records, query]);

  return (
    <Drawer open={open} onClose={onClose} title={cls ? `${cls.name} · Roster` : 'Roster'}>
      {!roster && <p className="py-6 text-sm text-slate-500">Loading roster…</p>}
      {roster && roster.length === 0 && (
        <p className="py-6 text-sm text-slate-500">No students are enrolled in this class’s batch yet.</p>
      )}
      {roster && roster.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{roster.length}</span> enrolled
            </p>
            <label className="relative w-full max-w-[14rem]">
              <span className="sr-only">Search students</span>
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.search}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students"
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-red-600 focus:outline-none"
              />
            </label>
          </div>
          {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No students match “{query}”.</p>}
          <ul className="divide-y divide-slate-100">
            {rows.map(({ student, attended, total, rate }) => (
              <li key={student.id} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {initials(student.user.firstName, student.user.lastName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {student.user.firstName} {student.user.lastName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{student.user.email}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-sm font-semibold tabular-nums ${rateTone(rate)}`}>
                    {rate === null ? '—' : `${rate}%`}
                  </span>
                  <span className="block text-[11px] tabular-nums text-slate-500">
                    {total === 0 ? 'Not marked yet' : `${attended} of ${total} sessions`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InstructorClassesPage() {
  const now = useNow();
  const myClasses = useMyClasses();
  const classIds = useMemo(() => myClasses.classes.map((c) => c.id), [myClasses.classes]);
  const schedules = useMySchedules(classIds);
  const rosters = useMyRosters(classIds);
  const attendance = useMyAttendance(classIds);

  const [selectedStatus, setStatus] = useState<string>('ALL');
  // Kept after closing so the drawer's contents stay put while it slides out.
  const [rosterClassId, setRosterClassId] = useState<string | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);

  const statuses = useMemo(() => {
    const present = new Set(myClasses.classes.map((c) => c.status));
    return STATUS_ORDER.filter((s) => present.has(s));
  }, [myClasses.classes]);
  // If the chosen status stops existing (e.g. the last ACTIVE class completes
  // on refetch), fall back to All rather than showing an unexplained blank.
  const status = selectedStatus === 'ALL' || statuses.includes(selectedStatus) ? selectedStatus : 'ALL';

  const visible = status === 'ALL' ? myClasses.classes : myClasses.classes.filter((c) => c.status === status);
  const weeklySessions = schedules.schedules.length;
  const rosterClass = myClasses.classes.find((c) => c.id === rosterClassId) ?? null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-wide text-slate-900">My Classes</h1>
          <p className="mt-1 text-sm text-slate-600">Sections you teach, with this week’s rhythm and attendance at a glance.</p>
        </div>
        {myClasses.classes.length > 0 && (
          <dl className="flex divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white py-2.5 text-sm">
            <div className="px-4">
              <dt className="text-xs text-slate-500">Classes</dt>
              <dd className="font-bold tabular-nums text-slate-900">{myClasses.classes.length}</dd>
            </div>
            <div className="px-4">
              <dt className="text-xs text-slate-500">Students</dt>
              <dd className="font-bold tabular-nums text-slate-900">
                {!rosters.enabled || rosters.isError ? '—' : rosters.isLoading ? '…' : rosters.total}
              </dd>
            </div>
            <div className="px-4">
              <dt className="text-xs text-slate-500">Sessions / week</dt>
              <dd className="font-bold tabular-nums text-slate-900">{schedules.isLoading ? '…' : weeklySessions}</dd>
            </div>
          </dl>
        )}
      </div>

      {statuses.length > 1 && (
        <div role="group" aria-label="Filter by status" className="mb-5 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {['ALL', ...statuses].map((s) => {
            const count = s === 'ALL' ? myClasses.classes.length : myClasses.classes.filter((c) => c.status === s).length;
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition focus-visible:outline-2 focus-visible:outline-red-700 ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL' ? 'All' : s.toLowerCase()}
                <span className="ml-1.5 tabular-nums text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {myClasses.isLoading && (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[22rem] animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {myClasses.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Couldn’t load your classes. Refresh the page to try again.
        </div>
      )}

      {!myClasses.isLoading && !myClasses.isError && myClasses.classes.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700 [&_svg]:h-7 [&_svg]:w-7">
            {icons.learn}
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No classes assigned yet</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Once the registrar assigns you to a class section, it will appear here with its schedule and roster.
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((cls) => {
            const index = myClasses.classes.indexOf(cls);
            return (
              <ClassCard
                key={cls.id}
                cls={cls}
                tone={TONES[index % TONES.length]}
                schedules={schedules.schedules.filter((s) => s.classId === cls.id)}
                schedulesLoading={schedules.isLoading}
                roster={rosters.byClass.get(cls.id)}
                rosterLoading={rosters.isLoading}
                rosterEnabled={rosters.enabled}
                records={attendance.records.filter((r) => r.classId === cls.id)}
                attendanceLoading={attendance.isLoading}
                now={now}
                onOpenRoster={() => {
                  setRosterClassId(cls.id);
                  setRosterOpen(true);
                }}
              />
            );
          })}
        </div>
      )}

      <RosterDrawer
        key={rosterClassId ?? 'none'}
        open={rosterOpen}
        cls={rosterClass}
        roster={rosterClassId ? rosters.byClass.get(rosterClassId) : undefined}
        records={attendance.records.filter((r) => r.classId === rosterClassId)}
        onClose={() => setRosterOpen(false)}
      />
    </div>
  );
}
