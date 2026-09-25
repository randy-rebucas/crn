'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatTime } from '@/lib/instructor-schedule';
import { StatusBadge } from '@/components/ui';
import { ScoreTrend } from '@/components/student-score-trend';
import {
  Panel,
  PanelLink,
  PanelMessage,
  SkeletonRows,
  StudentShell,
  icons,
  programGlyph,
} from '@/components/student-ui';
import { instructorIcons } from '@/components/instructor-ui';
import {
  type Enrollment,
  type Notification,
  pickActiveEnrollment,
  useMyAttempts,
  useMyEnrollments,
  useMyNotifications,
  useMyStudentProfile,
} from '@/lib/student-hooks';

interface ClassRecord {
  id: string;
  name: string;
  batchId: string;
  course: { name: string; code: string };
}

interface Schedule {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface TodaysClass {
  scheduleId: string;
  className: string;
  courseName: string;
  startTime: string;
  endTime: string;
}

interface ExamItem {
  id: string;
  title: string;
  type: string;
  status: string;
  programId: string | null;
  attemptLimit: number;
  timeLimitMinutes: number | null;
}

interface Course {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface MyProgress {
  overall: { averageScorePct: number | null; attendanceRate: number | null };
}

// Home is the student's "where do I stand" view. Every number traces back to
// a real endpoint: exam scores and passing marks from /v1/attempts/me,
// attendance from /v1/progress/me, the review-period bar from the batch's own
// start/end dates. There is no lesson-completion tracking server-side, so
// nothing here pretends to be a per-course completion percentage.

// ---------------------------------------------------------------------------
// Glyphs local to this view (same 1.7px stroke / 24 grid as the shared set)
// ---------------------------------------------------------------------------

const glyphs = {
  megaphone: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5v-15L7 9H5a1 1 0 0 0-1 1ZM7 15l1.2 4.5M18.5 9.5a3.5 3.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx={12} cy={12} r={8.3} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={12} cy={12} r={4.5} stroke="currentColor" strokeWidth={1.7} />
      <circle cx={12} cy={12} r={1} fill="currentColor" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function humanize(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

function plural(n: number, word: string) {
  if (n === 1) return `${n} ${word}`;
  return `${n} ${word}${word.endsWith('s') ? 'es' : 's'}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Where the student is inside their batch's review window, from the batch's
// real start/end dates.
function reviewPeriod(batch: NonNullable<Enrollment['batch']>, now: Date) {
  const start = new Date(batch.startDate).getTime();
  const end = batch.endDate ? new Date(batch.endDate).getTime() : null;
  const t = now.getTime();
  if (t < start) {
    return { state: 'upcoming' as const, label: `Starts ${shortDate(batch.startDate)}`, pct: 0, detail: `in ${plural(Math.ceil((start - t) / DAY_MS), 'day')}` };
  }
  if (!end) {
    const week = Math.floor((t - start) / (7 * DAY_MS)) + 1;
    return { state: 'open' as const, label: `Week ${week}`, pct: null, detail: `Started ${shortDate(batch.startDate)}` };
  }
  if (t >= end) {
    return { state: 'done' as const, label: 'Review period complete', pct: 100, detail: `Ended ${shortDate(batch.endDate!)}` };
  }
  const totalWeeks = Math.max(1, Math.ceil((end - start) / (7 * DAY_MS)));
  const week = Math.min(totalWeeks, Math.floor((t - start) / (7 * DAY_MS)) + 1);
  const daysLeft = Math.ceil((end - t) / DAY_MS);
  return {
    state: 'active' as const,
    label: `Week ${week} of ${totalWeeks}`,
    pct: Math.round(((t - start) / (end - start)) * 100),
    detail: `${plural(daysLeft, 'day')} left · ends ${shortDate(batch.endDate!)}`,
  };
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({ name, now, summary }: { name?: string; now: Date; summary: string }) {
  return (
    <section className="relative isolate mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-amber-100 to-amber-300 ring-1 ring-amber-200/70">
      {/* Diagonal brand ribbons, shared with the instructor hero and the public site's cut collage. */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-3 bg-red-600 [clip-path:polygon(0_0,100%_0,0_100%)] sm:w-6" />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-[40%] bg-amber-400 [clip-path:polygon(24%_0,100%_0,100%_100%,0_100%)] sm:block"
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-[40%] bg-red-600 [clip-path:polygon(24%_0,28%_0,4%_100%,0_100%)] sm:block"
      />

      <div className="relative grid items-end sm:grid-cols-[1.4fr_1fr]">
        <div className="px-6 py-6 sm:px-10 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900/80">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.05] tracking-wide text-slate-900 [text-wrap:balance] sm:text-4xl lg:text-5xl">
            {greeting(now)}
            {name ? (
              <>
                , <span className="text-red-700">{name}!</span>
              </>
            ) : (
              '!'
            )}
          </h1>
          <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-slate-700 sm:text-base">{summary}</p>
          <p className="mt-4 flex items-center gap-3 text-red-700">
            <span className="font-script text-xl text-slate-900 sm:text-2xl">Same Passion. A Healthier Tomorrow.</span>
            <span className="hidden xl:block">{instructorIcons.pulse}</span>
          </p>
        </div>
        <div className="relative hidden h-full min-h-[210px] sm:block">
          <Image
            src="/02_graduate_holding_diploma.png"
            alt="A smiling graduate holding a healthcare professionals diploma"
            fill
            sizes="(min-width: 1280px) 360px, 36vw"
            className="object-contain object-bottom pt-4 [filter:drop-shadow(0_14px_22px_rgb(120_53_15/0.25))]"
            priority
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Standing: average score ring + the supporting numbers it's made of
// ---------------------------------------------------------------------------

function ScoreRing({ pct }: { pct: number | null }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const value = pct ?? 0;
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx={40} cy={40} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
        {pct !== null && (
          <circle
            cx={40}
            cy={40}
            r={r}
            fill="none"
            stroke="#b91c1c"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * c} ${c}`}
            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-heading)] text-2xl font-bold tabular-nums text-slate-900">
        {pct === null ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

function Figure({
  icon,
  tone,
  value,
  label,
  loading,
}: {
  icon: React.ReactNode;
  tone: string;
  value: React.ReactNode;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div className="min-w-0">
        {loading ? (
          <span className="block h-6 w-10 animate-pulse rounded bg-slate-200" aria-label="Loading" />
        ) : (
          <span className="block text-xl font-bold leading-tight tabular-nums text-slate-900">{value}</span>
        )}
        <span className="block text-xs leading-snug text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function StandingPanel({
  averagePct,
  gradedCount,
  passRate,
  attendance,
  openExams,
  loading,
}: {
  averagePct: number | null;
  gradedCount: number;
  passRate: number | null;
  attendance: { value: number | null; loading: boolean; available: boolean };
  openExams: { value: number; loading: boolean };
  loading: boolean;
}) {
  return (
    <section
      aria-label="Your standing"
      className="mb-5 grid gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:p-5 xl:grid-cols-[auto_1fr] xl:items-center xl:gap-8"
    >
      <Link
        href="/student/progress"
        className="group flex items-center gap-4 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700 xl:border-r xl:border-slate-100 xl:pr-8"
      >
        {loading ? <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-slate-100" /> : <ScoreRing pct={averagePct} />}
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">Average score</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {gradedCount === 0 ? 'Appears after your first graded exam' : `Across ${plural(gradedCount, 'graded exam')}`}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
            See performance
            <span className="transition group-hover:translate-x-0.5 motion-reduce:transition-none">{instructorIcons.arrowRight}</span>
          </p>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-x-3 border-t border-slate-100 pt-4 sm:gap-x-4 xl:border-t-0 xl:pt-0">
        <Figure
          icon={instructorIcons.checkCircle}
          tone="bg-emerald-50 text-emerald-700"
          value={passRate === null ? '—' : `${passRate}%`}
          label="Pass rate"
          loading={loading}
        />
        <Figure
          icon={icons.schedule}
          tone="bg-blue-50 text-blue-700"
          value={attendance.available && attendance.value !== null ? `${attendance.value}%` : '—'}
          label={attendance.available ? 'Attendance' : 'Attendance unavailable'}
          loading={attendance.loading}
        />
        <Figure
          icon={icons.exams}
          tone="bg-amber-50 text-amber-700"
          value={openExams.value}
          label={openExams.value === 1 ? 'Exam open now' : 'Exams open now'}
          loading={openExams.loading}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// My program
// ---------------------------------------------------------------------------

function ProgramPanel({ active, now }: { active: Enrollment | null; now: Date }) {
  const courses = useQuery<Course[]>({
    queryKey: ['learn-courses', active?.programId],
    enabled: Boolean(active),
    queryFn: async () => {
      const { data } = await apiClient.get<Course[]>('/v1/courses', { params: { programId: active!.programId } });
      return data.filter((c) => c.status === 'PUBLISHED');
    },
  });

  if (!active) {
    return (
      <Panel title="My Program" icon={icons.learn}>
        <PanelMessage>
          <span>You don&apos;t have an active enrollment yet.</span>
          <span className="text-xs">Your program, batch, and courses will show up here once you&apos;re enrolled.</span>
        </PanelMessage>
      </Panel>
    );
  }

  const period = active.batch ? reviewPeriod(active.batch, now) : null;
  const shownCourses = (courses.data ?? []).slice(0, 6);
  const extra = (courses.data?.length ?? 0) - shownCourses.length;

  return (
    <Panel title="My Program" icon={icons.learn} action={<PanelLink href="/student/learn">Open courses</PanelLink>}>
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-700 text-white [&_svg]:h-7 [&_svg]:w-7">
          {programGlyph(active.program.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-xl font-semibold tracking-wide text-slate-900">{active.program.name}</h3>
            <StatusBadge status={active.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500">{active.batch ? active.batch.name : 'Not yet assigned to a batch'}</p>
        </div>
      </div>

      {period && (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">
              <span className="sr-only">Review period: </span>
              {period.label}
            </p>
            <p className="text-xs text-slate-500">{period.detail}</p>
          </div>
          {period.pct !== null && (
            <div
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-200"
              role="progressbar"
              aria-label="Review period elapsed"
              aria-valuenow={period.pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full ${period.state === 'done' ? 'bg-emerald-600' : 'bg-gradient-to-r from-red-600 to-red-700'}`}
                style={{ width: `${Math.max(period.pct, 2)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-slate-700">
          Courses{courses.data ? <span className="font-normal text-slate-500"> · {courses.data.length}</span> : null}
        </p>
        {courses.isLoading && <SkeletonRows count={2} className="h-9" />}
        {courses.isError && <p className="text-sm text-red-700">Couldn&apos;t load your courses.</p>}
        {courses.data && courses.data.length === 0 && (
          <p className="text-sm text-slate-500">Your program&apos;s courses haven&apos;t been published yet.</p>
        )}
        {shownCourses.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {shownCourses.map((c) => (
              <li key={c.id}>
                <Link
                  href="/student/learn"
                  className="inline-flex max-w-[16rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-red-700">{c.code}</span>
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            ))}
            {extra > 0 && (
              <li>
                <Link
                  href="/student/learn"
                  className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-red-700"
                >
                  +{extra} more
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Study tools
// ---------------------------------------------------------------------------

const TOOLS = [
  { label: 'Practice Exams', hint: 'Full mock board exams', href: '/student/practice-exams', icon: icons.practice, tone: 'bg-red-50 text-red-700 group-hover:bg-red-100' },
  { label: 'Quizzes', hint: 'Test your knowledge', href: '/student/quizzes', icon: icons.quiz, tone: 'bg-blue-50 text-blue-700 group-hover:bg-blue-100' },
  { label: 'Study Materials', hint: 'Handouts and notes', href: '/student/materials', icon: icons.materials, tone: 'bg-violet-50 text-violet-700 group-hover:bg-violet-100' },
  { label: 'Performance', hint: 'Track your progress', href: '/student/progress', icon: icons.progress, tone: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100' },
];

function StudyTools() {
  return (
    <Panel title="Study Tools" icon={glyphs.target} className="@container">
      <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="group flex h-full flex-col items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_-18px_rgb(15_23_42/0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl transition [&_svg]:h-[22px] [&_svg]:w-[22px] ${tool.tone}`}>
                {tool.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{tool.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{tool.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Right rail
// ---------------------------------------------------------------------------

function TodayPanel({
  now,
  hasBatch,
  items,
  loading,
  error,
}: {
  now: Date;
  hasBatch: boolean;
  items: TodaysClass[];
  loading: boolean;
  error: boolean;
}) {
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <Panel title="Today's Schedule" icon={icons.schedule} action={<PanelLink href="/student/schedule">Full week</PanelLink>}>
      {!hasBatch && <PanelMessage>You&apos;re not assigned to a batch yet, so nothing is scheduled.</PanelMessage>}
      {hasBatch && loading && <SkeletonRows />}
      {hasBatch && !loading && error && <PanelMessage tone="error">Couldn&apos;t load today&apos;s classes.</PanelMessage>}
      {hasBatch && !loading && !error && items.length === 0 && (
        <PanelMessage>
          <span className="text-slate-400">{instructorIcons.checkCircle}</span>
          No classes today. A good day to take a practice exam.
        </PanelMessage>
      )}
      {hasBatch && !loading && !error && items.length > 0 && (
        <ol className="space-y-2.5">
          {items.map((item) => {
            const done = item.endTime <= nowHHMM;
            const live = !done && item.startTime <= nowHHMM;
            return (
              <li key={item.scheduleId} className={`flex items-center gap-3 rounded-xl p-2.5 ${live ? 'bg-red-50' : ''}`}>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5 ${
                    done ? 'bg-slate-100 text-slate-400' : live ? 'bg-red-700 text-white' : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {instructorIcons.clock}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${done ? 'text-slate-500' : 'text-slate-900'}`}>{item.className}</span>
                  <span className="block truncate text-xs text-slate-500">{item.courseName}</span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums">
                  <span className={`block font-semibold ${done ? 'text-slate-400' : 'text-slate-700'}`}>{formatTime(item.startTime)}</span>
                  <span className={`block ${live ? 'font-semibold text-red-700' : 'text-slate-400'}`}>
                    {live ? 'Now' : done ? 'Ended' : formatTime(item.endTime)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function ExamsPanel({
  hasEnrollment,
  exams,
  total,
  loading,
  error,
}: {
  hasEnrollment: boolean;
  exams: ExamItem[];
  total: number;
  loading: boolean;
  error: boolean;
}) {
  return (
    <Panel
      title="Open Exams"
      icon={icons.exams}
      action={hasEnrollment && total > 0 ? <PanelLink href="/student/exams">View all{total > exams.length ? ` ${total}` : ''}</PanelLink> : undefined}
    >
      {!hasEnrollment && <PanelMessage>Exams appear here once you&apos;re enrolled in a program.</PanelMessage>}
      {hasEnrollment && loading && <SkeletonRows />}
      {hasEnrollment && !loading && error && <PanelMessage tone="error">Couldn&apos;t load exams.</PanelMessage>}
      {hasEnrollment && !loading && !error && exams.length === 0 && (
        <PanelMessage>Nothing is published for your program yet.</PanelMessage>
      )}
      {exams.length > 0 && (
        <ul className="-mx-2 divide-y divide-slate-100">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href={`/student/exams/${exam.id}`}
                className="group flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-red-700"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">{icons.exams}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{exam.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span className="truncate">{humanize(exam.type)}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums [&_svg]:h-3.5 [&_svg]:w-3.5">
                      {instructorIcons.clock}
                      {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : 'Untimed'}
                    </span>
                  </span>
                </span>
                <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-red-700 motion-reduce:transition-none">
                  {instructorIcons.chevronRight}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function notificationStyle(n: Notification) {
  const t = `${n.type} ${n.title}`.toLowerCase();
  if (t.includes('exam') || t.includes('result') || t.includes('grade')) return { icon: icons.exams, tone: 'bg-red-50 text-red-700' };
  if (t.includes('schedule') || t.includes('class')) return { icon: icons.schedule, tone: 'bg-blue-50 text-blue-700' };
  if (t.includes('material') || t.includes('lesson') || t.includes('course')) return { icon: icons.learn, tone: 'bg-emerald-50 text-emerald-700' };
  if (t.includes('enroll') || t.includes('payment')) return { icon: icons.certificate, tone: 'bg-violet-50 text-violet-700' };
  return { icon: glyphs.megaphone, tone: 'bg-amber-50 text-amber-700' };
}

function AnnouncementsPanel({
  items,
  loading,
  error,
  className,
}: {
  items: Notification[];
  loading: boolean;
  error: boolean;
  className?: string;
}) {
  return (
    <Panel title="Notifications" icon={icons.bell} className={className} action={<PanelLink href="/student/notifications">View all</PanelLink>}>
      {loading && <SkeletonRows />}
      {!loading && error && <PanelMessage tone="error">Couldn&apos;t load announcements.</PanelMessage>}
      {!loading && !error && items.length === 0 && <PanelMessage>Nothing new. You&apos;re all caught up.</PanelMessage>}
      {items.length > 0 && (
        <ul className="space-y-4">
          {items.map((n) => {
            const s = notificationStyle(n);
            return (
              <li key={n.id} className="flex items-start gap-3">
                <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                  {s.icon}
                  {!n.readAt && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white">
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${n.readAt ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</p>
                  {n.body && <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{n.body}</p>}
                  <time dateTime={n.createdAt} className="mt-0.5 block text-[11px] text-slate-400">
                    {shortDate(n.createdAt)}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// GAP: same as schedule/page.tsx — `GET /v1/classes` has no batchId filter,
// so we fetch every class in the org and narrow to the active batch
// client-side, then fan out a schedules request per class to find today's
// meetings. A `GET /v1/schedules?batchId=` (or a combined "my schedule today"
// endpoint) would remove the fan-out.
export default function StudentHomePage() {
  const [now] = useState(() => new Date());
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
  const notifications = useMyNotifications();
  const attempts = useMyAttempts();
  const active = pickActiveEnrollment(enrollments.data);
  const batchId = active?.batchId ?? undefined;

  const todaysClasses = useQuery<TodaysClass[]>({
    queryKey: ['home-todays-classes', batchId],
    enabled: Boolean(batchId),
    queryFn: async () => {
      const { data: classes } = await apiClient.get<ClassRecord[]>('/v1/classes');
      const mine = classes.filter((c) => c.batchId === batchId);
      const today = new Date().getDay();

      const perClass = await Promise.all(
        mine.map(async (cls) => {
          const { data: schedules } = await apiClient.get<Schedule[]>('/v1/schedules', {
            params: { classId: cls.id },
          });
          return schedules
            .filter((s) => s.dayOfWeek === today)
            .map((s) => ({
              scheduleId: s.id,
              className: cls.name,
              courseName: cls.course.name,
              startTime: s.startTime,
              endTime: s.endTime,
            }));
        }),
      );

      return perClass.flat().sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
    },
  });

  // Same available-to-take framing as exams/page.tsx: exams for the active
  // program. No due-date data exists server-side, so this reads as "open
  // now" rather than a countdown to scheduled dates.
  const exams = useQuery<ExamItem[]>({
    queryKey: ['home-exams', active?.programId],
    enabled: Boolean(active),
    queryFn: async () => {
      const { data } = await apiClient.get<ExamItem[]>('/v1/exams');
      return data.filter((e) => !e.programId || e.programId === active!.programId);
    },
  });

  // Attendance lives only in the progress read model. Students without
  // `progress.view` get a 403 — the tile then says so instead of guessing.
  const progress = useQuery<MyProgress>({
    queryKey: ['my-progress'],
    enabled: Boolean(profile.data),
    retry: false,
    queryFn: async () => (await apiClient.get<MyProgress>('/v1/progress/me')).data,
  });

  const graded = (attempts.data ?? []).filter((a) => a.status === 'GRADED' && a.score !== undefined && a.maxScore);
  const averagePct =
    graded.length > 0 ? Math.round((graded.reduce((sum, a) => sum + a.score! / a.maxScore!, 0) / graded.length) * 100) : null;
  const passRate = graded.length > 0 ? Math.round((graded.filter((a) => a.passed).length / graded.length) * 100) : null;

  const recentNotifications = (notifications.data ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 4);

  const examCount = exams.data?.length ?? 0;
  const classCount = todaysClasses.data?.length ?? 0;

  const summaryParts: string[] = [];
  if (batchId && todaysClasses.data) {
    summaryParts.push(classCount === 0 ? 'No classes on your schedule today' : `You have ${plural(classCount, 'class')} today`);
  }
  if (active && exams.data && examCount > 0) {
    summaryParts.push(`${plural(examCount, 'exam')} open for practice`);
  }
  const summary =
    summaryParts.length > 0
      ? `${summaryParts.join(', and ')}. Keep going — you're one step closer to your license.`
      : "Keep learning. You're one step closer to your goal.";

  const isLoading = profile.isLoading || enrollments.isLoading;
  const isError = profile.isError || enrollments.isError;

  if (isError) {
    return (
      <StudentShell>
        <PanelMessage tone="error">Couldn&apos;t load your dashboard. Refresh the page to try again.</PanelMessage>
      </StudentShell>
    );
  }

  return (
    <StudentShell>
      <Hero name={profile.data?.user.firstName} now={now} summary={summary} />

      <StandingPanel
        averagePct={averagePct}
        gradedCount={graded.length}
        passRate={passRate}
        attendance={{
          value: progress.data?.overall.attendanceRate ?? null,
          loading: progress.isLoading,
          available: !progress.isError,
        }}
        openExams={{ value: examCount, loading: Boolean(active) && exams.isLoading }}
        loading={attempts.isLoading}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:items-start">
        <div className="grid min-w-0 gap-5">
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
          ) : (
            <ProgramPanel active={active} now={now} />
          )}
          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] xl:grid-cols-1 2xl:grid-cols-[1.35fr_1fr]">
            <ScoreTrend attempts={attempts.data ?? []} loading={attempts.isLoading} error={attempts.isError} icon={instructorIcons.barChart} />
            <StudyTools />
          </div>
        </div>

        <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1" aria-label="Today and updates">
          <TodayPanel
            now={now}
            hasBatch={Boolean(batchId) || isLoading}
            items={todaysClasses.data ?? []}
            loading={isLoading || todaysClasses.isLoading}
            error={todaysClasses.isError}
          />
          <ExamsPanel
            hasEnrollment={Boolean(active) || isLoading}
            exams={(exams.data ?? []).slice(0, 4)}
            total={examCount}
            loading={isLoading || exams.isLoading}
            error={exams.isError}
          />
          <AnnouncementsPanel
            className="md:col-span-2 xl:col-span-1"
            items={recentNotifications}
            loading={notifications.isLoading}
            error={notifications.isError}
          />
        </aside>
      </div>

      <section className="relative mt-5 flex flex-col items-start gap-4 overflow-hidden rounded-2xl bg-red-800 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div aria-hidden className="absolute inset-y-0 right-0 w-1/3 bg-red-900/40 [clip-path:polygon(30%_0,100%_0,100%_100%,0_100%)]" />
        <div className="relative flex items-center gap-4">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-red-900 sm:flex [&_svg]:h-6 [&_svg]:w-6">
            {instructorIcons.graduation}
          </span>
          <div>
            <p className="font-[family-name:var(--font-heading)] text-2xl font-bold uppercase tracking-wide">Your Success Is Our Mission!</p>
            <p className="text-sm text-red-100">A practice exam today is one less surprise on board day.</p>
          </div>
        </div>
        <Link
          href="/student/exams"
          className="relative inline-flex shrink-0 items-center gap-2 rounded-md bg-amber-400 px-4 py-2.5 text-sm font-bold text-red-950 transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          Take a practice exam
          {instructorIcons.arrowRight}
        </Link>
      </section>
    </StudentShell>
  );
}
