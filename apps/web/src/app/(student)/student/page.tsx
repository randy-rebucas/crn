'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { Chevron, SectionLabel, StudentShell, icons } from '@/components/student-ui';
import { pickActiveEnrollment, useMyEnrollments, useMyNotifications, useMyStudentProfile } from '@/lib/student-hooks';

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

const QUICK_LINKS = [
  { label: 'Continue learning', href: '/student/learn', icon: icons.learn },
  { label: 'Take an exam', href: '/student/exams', icon: icons.exams },
  { label: 'My performance', href: '/student/progress', icon: icons.progress },
  { label: 'Class schedule', href: '/student/schedule', icon: icons.schedule },
];

// GAP: same as schedule/page.tsx — `GET /v1/classes` has no batchId filter,
// so we fetch every class in the org and narrow to the active batch
// client-side, then fan out a schedules request per class to find today's
// meetings. Fine for a small cohort; a `GET /v1/schedules?batchId=` (or a
// combined "my schedule today" endpoint) would remove the fan-out.
//
// Home is a single at-a-glance card stack: hero greeting, enrollment
// status, quick actions, and available exams in the main column; today's
// schedule and recent announcements in the right rail (stacked below on
// mobile). No course-completion-percent or exam-due-date data exists
// server-side, so this deliberately doesn't fabricate progress rings or
// countdown badges — every number here traces back to a real endpoint.
export default function StudentHomePage() {
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
  const notifications = useMyNotifications();
  const active = pickActiveEnrollment(enrollments.data);
  const batchId = active?.batchId ?? undefined;
  const recentNotifications = (notifications.data ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3);

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

  // Same available-to-take framing as exams/page.tsx: PUBLISHED exams for
  // the active program, minus ones already exhausted. No due-date data
  // exists server-side, so this reads as "open now" rather than a
  // calendar of upcoming dates.
  const exams = useQuery<ExamItem[]>({
    queryKey: ['home-exams', active?.programId],
    enabled: Boolean(active),
    queryFn: async () => {
      const { data } = await apiClient.get<ExamItem[]>('/v1/exams');
      return data.filter((e) => !e.programId || e.programId === active!.programId);
    },
  });
  const availableExams = (exams.data ?? []).slice(0, 3);

  const isLoading = profile.isLoading || enrollments.isLoading;
  const isError = profile.isError || enrollments.isError;

  if (isLoading) {
    return (
      <StudentShell>
        <LoadingState />
      </StudentShell>
    );
  }
  if (isError) {
    return (
      <StudentShell>
        <ErrorState message="Could not load your dashboard." />
      </StudentShell>
    );
  }

  const firstName = profile.data?.user.firstName;

  return (
    <StudentShell>
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-700 via-red-700 to-red-900 px-5 py-6 text-white lg:px-8 lg:py-8">
        <span className="pointer-events-none absolute -right-6 -top-6 text-red-600/40 [&>svg]:h-32 [&>svg]:w-32 lg:[&>svg]:h-40 lg:[&>svg]:w-40">
          {icons.certificate}
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-red-200">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="relative mt-1 text-2xl font-semibold lg:text-3xl">
          {firstName ? `Good day, ${firstName}!` : 'Welcome back'}
        </h1>
        <p className="relative mt-1 max-w-sm text-sm text-red-100">
          Keep learning. You&apos;re one step closer to your goal.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        {/* Main column */}
        <div className="lg:col-span-2">
          <SectionLabel>Enrollment status</SectionLabel>
          <Card className="p-4">
            {!active && (
              <p className="text-sm text-slate-500">You don&apos;t have an active enrollment yet.</p>
            )}
            {active && (
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-700 text-white [&>svg]:h-6 [&>svg]:w-6">
                  {icons.learn}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{active.program.name}</p>
                  {active.batch && <p className="truncate text-xs text-slate-500">{active.batch.name}</p>}
                </div>
                <StatusBadge status={active.status} />
              </div>
            )}
          </Card>

          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_LINKS.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] flex-col items-center gap-2 rounded-xl px-4 py-4 text-center text-sm font-medium transition ${
                  i === 0
                    ? 'bg-red-700 text-white active:bg-red-800 lg:hover:bg-red-800'
                    : 'border border-slate-200 bg-white text-slate-700 active:bg-slate-100 lg:hover:bg-slate-50'
                }`}
              >
                <span className={`[&>svg]:h-5 [&>svg]:w-5 ${i === 0 ? 'text-white' : 'text-red-700'}`}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <SectionLabel>Available exams</SectionLabel>
          <Card className="divide-y divide-slate-100 p-0">
            {!active && (
              <p className="p-4 text-sm text-slate-500">Exams appear here once you&apos;re enrolled in a program.</p>
            )}
            {active && exams.isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
            {active && exams.isError && <p className="p-4 text-sm text-red-600">Could not load exams.</p>}
            {active && exams.data && exams.data.length === 0 && (
              <p className="p-4 text-sm text-slate-500">Nothing published for your program yet.</p>
            )}
            {availableExams.length > 0 &&
              availableExams.map((exam) => (
                <Link
                  key={exam.id}
                  href={`/student/exams/${exam.id}`}
                  className="flex items-center gap-3 p-4 active:bg-slate-50 lg:hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 [&>svg]:h-5 [&>svg]:w-5">
                    {icons.exams}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{exam.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {exam.type} · {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : 'No time limit'}
                    </p>
                  </div>
                  <Chevron open={false} />
                </Link>
              ))}
          </Card>
        </div>

        {/* Right rail (desktop) */}
        <div className="lg:col-span-1">
          <div className="mb-2 mt-6 flex items-center justify-between lg:mt-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Today&apos;s schedule</h2>
          </div>
          <Card className="p-4">
            {!batchId && (
              <p className="text-sm text-slate-500">
                You&apos;re not currently assigned to a batch, so there&apos;s nothing scheduled for today.
              </p>
            )}
            {batchId && todaysClasses.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {batchId && todaysClasses.isError && (
              <p className="text-sm text-red-600">Could not load today&apos;s classes.</p>
            )}
            {batchId && todaysClasses.data && todaysClasses.data.length === 0 && (
              <p className="text-sm text-slate-500">No classes scheduled for today. Enjoy the break.</p>
            )}
            {batchId && todaysClasses.data && todaysClasses.data.length > 0 && (
              <ul className="flex flex-col gap-3">
                {todaysClasses.data.map((item) => (
                  <li key={item.scheduleId} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-red-700 text-[11px] font-semibold text-white">
                      {item.startTime}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.className}</p>
                      <p className="truncate text-xs text-slate-500">
                        {item.courseName} · {item.startTime}–{item.endTime}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="mb-2 mt-6 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent announcements</h2>
            <Link href="/student/notifications" className="text-xs font-medium text-red-700">
              View all
            </Link>
          </div>
          <Card className="p-4">
            {notifications.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {notifications.data && recentNotifications.length === 0 && (
              <p className="text-sm text-slate-500">Nothing new. You&apos;re all caught up.</p>
            )}
            {recentNotifications.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {recentNotifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
                      {!n.readAt && <span className="h-2 w-2 rounded-full bg-red-700" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{n.title}</p>
                      {n.body && <p className="truncate text-xs text-slate-500">{n.body}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </StudentShell>
  );
}
