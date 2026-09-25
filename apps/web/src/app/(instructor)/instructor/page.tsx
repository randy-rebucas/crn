'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Text, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/lib/auth-context';
import {
  type AgendaItem,
  attendanceRate,
  buildAgenda,
  dayKey,
  formatTime,
  relativeDay,
  timeAgo,
} from '@/lib/instructor-schedule';
import {
  type AttendanceRecord,
  type InstructorClass,
  useGradingQueue,
  useInstructorName,
  useMyAttendance,
  useMyClasses,
  useMyRosters,
  useMySchedules,
} from '@/lib/instructor-hooks';
import { useMyNotifications } from '@/lib/student-hooks';
import { instructorIcons as icons } from '@/components/instructor-ui';

// The instructor's "Today" view. Every number is derived from endpoints the
// instructor already has permission for (see lib/instructor-hooks.ts) — no
// invented trends. A module the account lacks permission for doesn't render.

// Module tones: red/amber/blue, the same trio StatusBadge already uses for
// attention / pending / in-review across the operate surfaces.
const TONES = {
  red: {
    bar: 'bg-red-600',
    wash: 'from-red-50',
    iconWrap: 'bg-red-100 text-red-700',
    arrow: 'bg-red-600 text-white group-hover:bg-red-700',
    chip: 'bg-red-50 text-red-700',
  },
  amber: {
    bar: 'bg-amber-400',
    wash: 'from-amber-50',
    iconWrap: 'bg-amber-100 text-amber-700',
    arrow: 'bg-amber-400 text-amber-950 group-hover:bg-amber-500',
    chip: 'bg-amber-50 text-amber-700',
  },
  blue: {
    bar: 'bg-blue-600',
    wash: 'from-blue-50',
    iconWrap: 'bg-blue-100 text-blue-700',
    arrow: 'bg-blue-600 text-white group-hover:bg-blue-700',
    chip: 'bg-blue-50 text-blue-700',
  },
} as const;

// Categorical series for the per-class chart, in the reference's order.
const SERIES = ['#dc2626', '#f59e0b', '#1e3a8a', '#60a5fa', '#be123c', '#0f766e'];

type Tone = keyof typeof TONES;

const RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Metric({
  icon,
  tone,
  value,
  label,
  loading,
  error,
}: {
  icon: React.ReactNode;
  tone: Tone;
  value: React.ReactNode;
  label: string;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONES[tone].chip}`}>{icon}</span>
      <div className="min-w-0">
        {loading ? (
          <span className="block h-6 w-10 animate-pulse rounded bg-slate-200" aria-label="Loading" />
        ) : (
          <span className="block text-xl font-bold leading-tight tabular-nums text-slate-900">{error ? '—' : value}</span>
        )}
        <span className="block text-xs leading-snug text-slate-500">{error ? `${label} unavailable` : label}</span>
      </div>
    </div>
  );
}

function ModuleCard({
  href,
  tone,
  icon,
  title,
  description,
  children,
}: {
  href: string;
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <Link
      href={href}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_30px_-18px_rgb(15_23_42/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} aria-hidden />
      <div className={`flex items-center gap-4 bg-gradient-to-b ${t.wash} to-white px-5 pb-4 pt-6`}>
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${t.iconWrap} [&_svg]:h-7 [&_svg]:w-7`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-wide text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-600">{description}</p>
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition group-hover:translate-x-0.5 ${t.arrow}`}
          aria-hidden
        >
          {icons.arrowRight}
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 px-5 py-4 [&>*+*]:pl-4">
        {children}
      </div>
    </Link>
  );
}

function Panel({
  title,
  icon,
  iconClass,
  action,
  children,
  className = '',
}: {
  title: string;
  icon: React.ReactNode;
  iconClass: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-wide text-slate-900">
          <span className={iconClass}>{icon}</span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      {children}
      {icons.arrowRight}
    </Link>
  );
}

function PanelMessage({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-sm ${
        tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'
      }`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({ name, summary }: { name: string; summary: string }) {
  return (
    <section className="relative isolate mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-amber-100 to-amber-300 ring-1 ring-amber-200/70">
      {/* Diagonal brand ribbons, echoing the public site's cut collage. */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-3 bg-red-600 [clip-path:polygon(0_0,100%_0,0_100%)] sm:w-6" />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-[46%] bg-amber-400 [clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)] md:block"
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-[46%] [clip-path:polygon(22%_0,26%_0,4%_100%,0_100%)] bg-red-600 md:block"
      />

      <div className="relative grid items-end md:grid-cols-[1.15fr_1fr]">
        <div className="px-6 py-7 sm:px-10 sm:py-9">
          <p className="text-lg font-medium text-slate-800 sm:text-xl">Welcome back,</p>
          <h1 className="mt-1 text-4xl font-bold leading-[1.02] tracking-wide text-red-700 [text-wrap:balance] sm:text-5xl">
            {name}!
          </h1>
          <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-slate-700 sm:text-base">{summary}</p>
          <p className="mt-4 flex items-center gap-3 text-red-700">
            <span className="font-script text-2xl text-slate-900 sm:text-3xl">Same Passion. A Healthier Tomorrow.</span>
            <span className="hidden sm:block">{icons.pulse}</span>
          </p>
        </div>
        <div className="relative hidden h-full min-h-[220px] md:block">
          <Image
            src="/instructor-banner-students.png"
            alt="Nursing and medical technology reviewees studying together"
            fill
            sizes="(min-width: 1280px) 560px, 45vw"
            className="object-contain object-bottom [filter:drop-shadow(0_14px_22px_rgb(120_53_15/0.22))]"
            priority
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

const DOT = {
  done: 'bg-slate-300 ring-slate-100',
  live: 'bg-red-600 ring-red-100 animate-pulse motion-reduce:animate-none',
  next: 'bg-amber-400 ring-amber-100',
  later: 'bg-blue-600 ring-blue-100',
} as const;

function SchedulePanel({
  agenda,
  now,
  loading,
  error,
}: {
  agenda: AgendaItem[];
  now: Date;
  loading: boolean;
  error: boolean;
}) {
  const todayItems = agenda.filter((a) => dayKey(a.date) === dayKey(now));
  const shown = (todayItems.length > 0 ? todayItems : agenda).slice(0, 4);
  const showingUpcoming = todayItems.length === 0;

  return (
    <Panel
      title={showingUpcoming ? 'Upcoming Sessions' : "Today's Schedule"}
      icon={icons.schedule}
      iconClass="text-red-600"
      action={<PanelLink href="/instructor/classes">My classes</PanelLink>}
    >
      <div className="flex flex-1 gap-5">
        <div className="hidden w-20 shrink-0 flex-col items-center justify-center border-r border-slate-100 pr-5 text-center sm:flex">
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            {now.toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <span className="font-[family-name:var(--font-heading)] text-5xl font-bold leading-none text-slate-900">
            {now.getDate()}
          </span>
          <span className="mt-1 text-xs font-medium uppercase text-slate-500">
            {now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {loading && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}
          {!loading && error && <PanelMessage tone="error">Couldn&apos;t load your schedule.</PanelMessage>}
          {!loading && !error && shown.length === 0 && (
            <PanelMessage>No weekly sessions are scheduled for your classes yet.</PanelMessage>
          )}
          {!loading && !error && shown.length > 0 && (
            <>
              {showingUpcoming && <p className="mb-3 text-xs text-slate-500">No sessions today. Here&apos;s what&apos;s next.</p>}
              <ol className="relative space-y-1 before:absolute before:bottom-6 before:left-[5px] before:top-6 before:w-px before:bg-slate-200">
                {shown.map((item) => (
                  <li key={item.key}>
                    <Link
                      href="/instructor/attendance"
                      className="group relative flex items-center gap-3 rounded-lg py-2.5 pl-0 pr-1 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
                    >
                      <span className={`relative z-10 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ${DOT[item.state]}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-xs font-semibold tabular-nums text-slate-700">
                          <span className="whitespace-nowrap">
                            {formatTime(item.schedule.startTime)} – {formatTime(item.schedule.endTime)}
                          </span>
                          {item.state === 'live' && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
                              In session
                            </span>
                          )}
                          {item.state === 'done' && <span className="font-medium text-slate-500">Ended</span>}
                          {showingUpcoming && <span className="font-medium text-slate-500">{relativeDay(item.date, now)}</span>}
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-sm font-semibold ${item.state === 'done' ? 'text-slate-500' : 'text-slate-900'}`}
                        >
                          {item.cls?.name ?? 'Class session'}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {item.cls?.room?.name ?? 'No room assigned'} · {item.cls?.course.name ?? 'Course'}
                        </span>
                      </span>
                      <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600">
                        {icons.chevronRight}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Class attendance chart
// ---------------------------------------------------------------------------

function WrappedTick(props: { x?: number; y?: number; payload?: { value: string }; width?: number }) {
  const { x = 0, y = 0, payload } = props;
  return (
    <Text x={x} y={y + 6} width={124} textAnchor="middle" verticalAnchor="start" fontSize={12} fill="#475569">
      {payload?.value ?? ''}
    </Text>
  );
}

function PerformancePanel({
  classes,
  records,
  now,
  loading,
  error,
}: {
  classes: InstructorClass[];
  records: AttendanceRecord[];
  now: Date;
  loading: boolean;
  error: boolean;
}) {
  const [range, setRange] = useState<RangeKey>('30d');

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days;
    const since = days ? now.getTime() - days * 86_400_000 : null;
    const inRange = since ? records.filter((r) => new Date(r.date).getTime() >= since) : records;
    return classes
      .map((cls) => {
        const rows = inRange.filter((r) => r.classId === cls.id);
        return { name: cls.name, rate: attendanceRate(rows), sessions: new Set(rows.map((r) => dayKey(new Date(r.date)))).size };
      })
      .filter((row): row is typeof row & { rate: number } => row.rate !== null)
      .map((row, i) => ({ ...row, color: SERIES[i % SERIES.length] }));
  }, [classes, records, range, now]);

  return (
    <Panel
      title="Attendance by Class"
      icon={icons.barChart}
      iconClass="text-red-600"
      action={
        <label className="relative">
          <span className="sr-only">Date range</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 transition hover:border-slate-300 focus:border-red-600 focus:outline-none"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">{icons.chevronDown}</span>
        </label>
      }
    >
      {loading && <div className="h-[240px] animate-pulse rounded-xl bg-slate-100" />}
      {!loading && error && <PanelMessage tone="error">Couldn&apos;t load attendance records.</PanelMessage>}
      {!loading && !error && data.length === 0 && (
        <PanelMessage>
          <span>No attendance has been marked {range === 'all' ? 'yet' : 'in this period'}.</span>
          <Link href="/instructor/attendance" className="font-semibold text-red-700 underline underline-offset-4">
            Take attendance
          </Link>
        </PanelMessage>
      )}
      {!loading && !error && data.length > 0 && (
        <figure className="flex-1">
          <figcaption className="sr-only">
            Attendance rate by class: {data.map((d) => `${d.name} ${d.rate}%`).join(', ')}
          </figcaption>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 22, right: 4, bottom: 8, left: -12 }}>
              <CartesianGrid vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="name" tick={<WrappedTick />} axisLine={false} tickLine={false} interval={0} height={44} />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: '#e2e8f0' }}
                formatter={(value, _name, item) => [`${value}% across ${item.payload.sessions} session${item.payload.sessions === 1 ? '' : 's'}`, 'Attendance']}
              />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {data.map((row) => (
                  <Cell key={row.name} fill={row.color} />
                ))}
                <LabelList dataKey="rate" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 12, fontWeight: 600, fill: '#0f172a' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </figure>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

interface ActivityItem {
  id: string;
  at: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
}

function ActivityPanel({ items, loading, className }: { items: ActivityItem[]; loading: boolean; className?: string }) {
  return (
    <Panel title="Recent Activity" icon={icons.bell} iconClass="text-red-600" className={className}>
      {loading && items.length === 0 && (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {!loading && items.length === 0 && <PanelMessage>Nothing new yet. Submissions and attendance will show up here.</PanelMessage>}
      {items.length > 0 && (
        <ul className="space-y-3.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                  <time dateTime={item.at} className="shrink-0 text-[11px] text-slate-500">
                    {timeAgo(item.at)}
                  </time>
                </div>
                <p className="truncate text-xs text-slate-500">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InstructorHomePage() {
  const { hasPermission } = useAuth();
  const canClasses = hasPermission('classes.view');
  const canAttendance = hasPermission('attendance.view');

  const [now] = useState(() => new Date());
  const name = useInstructorName();
  const myClasses = useMyClasses();
  const classIds = useMemo(() => myClasses.classes.map((c) => c.id), [myClasses.classes]);
  const classById = useMemo(() => new Map(myClasses.classes.map((c) => [c.id, c])), [myClasses.classes]);

  const schedules = useMySchedules(classIds);
  const roster = useMyRosters(classIds);
  const attendance = useMyAttendance(classIds);
  const grading = useGradingQueue();
  const notifications = useMyNotifications();

  const agenda = useMemo(() => buildAgenda(schedules.schedules, classById, now), [schedules.schedules, classById, now]);
  const sessionsToday = agenda.filter((a) => dayKey(a.date) === dayKey(now)).length;
  const overallRate = useMemo(() => {
    const since = now.getTime() - 30 * 86_400_000;
    return attendanceRate(attendance.records.filter((r) => new Date(r.date).getTime() >= since));
  }, [attendance.records, now]);

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const a of grading.attempts) {
      const who = `${a.student.user.firstName} ${a.student.user.lastName}`;
      const exam = grading.examTitle.get(a.examId) ?? 'Exam';
      if (a.status === 'SUBMITTED' && a.submittedAt) {
        items.push({ id: `sub-${a.id}`, at: a.submittedAt, title: 'Exam attempt submitted', detail: `${who} · ${exam}`, icon: icons.fileText, tone: 'bg-red-50 text-red-600' });
      }
      if (a.status === 'GRADED' && a.gradedAt) {
        items.push({ id: `grd-${a.id}`, at: a.gradedAt, title: 'Attempt graded', detail: `${who} · ${exam}`, icon: icons.clipboardCheck, tone: 'bg-blue-50 text-blue-600' });
      }
    }
    // One entry per class session marked, not per student row.
    const sessions = new Map<string, { at: string; classId: string; date: string; count: number }>();
    for (const r of attendance.records) {
      const key = `${r.classId}-${r.date.slice(0, 10)}`;
      const existing = sessions.get(key);
      const at = r.updatedAt ?? r.createdAt;
      if (!existing) sessions.set(key, { at, classId: r.classId, date: r.date, count: 1 });
      else {
        existing.count += 1;
        if (at > existing.at) existing.at = at;
      }
    }
    for (const [key, s] of sessions) {
      const day = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      items.push({
        id: `att-${key}`,
        at: s.at,
        title: 'Attendance marked',
        detail: `${classById.get(s.classId)?.name ?? 'Class'} · ${day} · ${s.count} student${s.count === 1 ? '' : 's'}`,
        icon: icons.users,
        tone: 'bg-amber-50 text-amber-600',
      });
    }
    for (const n of notifications.data ?? []) {
      items.push({ id: `ntf-${n.id}`, at: n.createdAt, title: n.title, detail: n.body ?? 'Notification', icon: icons.bell, tone: 'bg-emerald-50 text-emerald-600' });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  }, [grading.attempts, grading.examTitle, attendance.records, classById, notifications.data]);

  const summaryParts: string[] = [];
  if (canClasses && !schedules.isLoading && !myClasses.isLoading) {
    summaryParts.push(
      sessionsToday === 0 ? 'You have no sessions scheduled today' : `You have ${sessionsToday} session${sessionsToday === 1 ? '' : 's'} today`,
    );
  }
  if (grading.enabled && !grading.isLoading && !grading.isError) {
    summaryParts.push(
      grading.pendingCount === 0
        ? 'your grading queue is clear'
        : `${grading.pendingCount} attempt${grading.pendingCount === 1 ? '' : 's'} waiting for a grade`,
    );
  }
  const summary =
    summaryParts.length > 0
      ? `${summaryParts.join(summaryParts.length === 2 ? ', and ' : '')}.`
      : 'Your expertise helps shape the next generation of healthcare professionals.';

  const anyModule = canClasses || canAttendance || grading.enabled;
  const classesLoading = myClasses.isLoading;

  return (
    <div>
      <Hero name={name.full} summary={summary.charAt(0).toUpperCase() + summary.slice(1)} />

      {!anyModule && (
        <PanelMessage>No instructor sections are enabled for your account yet. Contact your administrator.</PanelMessage>
      )}

      <div className="mb-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {canClasses && (
          <ModuleCard href="/instructor/classes" tone="red" icon={icons.learn} title="My Classes" description="Today's sessions and rosters">
            <Metric icon={icons.users} tone="red" value={myClasses.classes.length} label="Active classes" loading={classesLoading} error={myClasses.isError} />
            <Metric
              icon={icons.graduation}
              tone="red"
              value={roster.total}
              label="Total students"
              loading={classesLoading || roster.isLoading}
              error={!canAttendance || roster.isError}
            />
          </ModuleCard>
        )}
        {canAttendance && (
          <ModuleCard href="/instructor/attendance" tone="amber" icon={icons.schedule} title="Attendance" description="Mark and review attendance">
            <Metric
              icon={icons.checkCircle}
              tone="amber"
              value={sessionsToday}
              label="Sessions today"
              loading={classesLoading || schedules.isLoading}
              error={schedules.isError}
            />
            <Metric
              icon={icons.clock}
              tone="amber"
              value={overallRate === null ? '—' : `${overallRate}%`}
              label="30-day attendance"
              loading={classesLoading || attendance.isLoading}
              error={attendance.isError}
            />
          </ModuleCard>
        )}
        {grading.enabled && (
          <ModuleCard href="/instructor/grading" tone="blue" icon={icons.fileText} title="Grading" description="Score attempts awaiting review">
            <Metric
              icon={icons.clipboardCheck}
              tone="blue"
              value={grading.pendingCount}
              label="Awaiting a grade"
              loading={grading.isLoading}
              error={grading.isError}
            />
            <Metric
              icon={icons.alert}
              tone="blue"
              value={grading.examsWithPending}
              label="Exams to review"
              loading={grading.isLoading}
              error={grading.isError}
            />
          </ModuleCard>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[1fr_1.15fr_1fr]">
        {canClasses && (
          <SchedulePanel agenda={agenda} now={now} loading={classesLoading || schedules.isLoading} error={myClasses.isError || schedules.isError} />
        )}
        {canAttendance && (
          <PerformancePanel
            classes={myClasses.classes}
            records={attendance.records}
            now={now}
            loading={classesLoading || attendance.isLoading}
            error={attendance.isError}
          />
        )}
        <ActivityPanel
          className={canClasses && canAttendance ? 'lg:col-span-2 xl:col-span-1' : ''}
          items={activity}
          loading={notifications.isLoading || grading.isLoading || attendance.isLoading || classesLoading}
        />
      </div>
    </div>
  );
}
