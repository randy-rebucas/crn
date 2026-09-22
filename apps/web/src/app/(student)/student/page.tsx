'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, SectionLabel } from '@/components/student-ui';
import { pickActiveEnrollment, useMyEnrollments, useMyStudentProfile } from '@/lib/student-hooks';

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

// GAP: same as schedule/page.tsx — `GET /v1/classes` has no batchId filter,
// so we fetch every class in the org and narrow to the active batch
// client-side, then fan out a schedules request per class to find today's
// meetings. Fine for a small cohort; a `GET /v1/schedules?batchId=` (or a
// combined "my schedule today" endpoint) would remove the fan-out.
//
// Home is a single at-a-glance card stack — today's classes first (the
// thing a student actually opens their phone to check), then enrollment
// status, then two large tap targets into Learn/Exams. Not a shrunk-down
// version of the admin dashboard.
export default function StudentHomePage() {
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
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

  return (
    <StudentShell>
      <p className="text-sm text-slate-500">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">
        {profile.data ? `Hi, ${profile.data.user.firstName}` : 'Welcome back'}
      </h1>

      <SectionLabel>Today&apos;s classes</SectionLabel>
      <Card className="p-4">
        {!batchId && (
          <p className="text-sm text-slate-500">
            You&apos;re not currently assigned to a batch, so there&apos;s nothing scheduled for today.
          </p>
        )}
        {batchId && todaysClasses.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {batchId && todaysClasses.isError && <p className="text-sm text-red-600">Could not load today&apos;s classes.</p>}
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

      <SectionLabel>Enrollment status</SectionLabel>
      <Card className="p-4">
        {!active && <p className="text-sm text-slate-500">You don&apos;t have an active enrollment yet.</p>}
        {active && (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{active.program.name}</p>
              {active.batch && <p className="truncate text-xs text-slate-500">{active.batch.name}</p>}
            </div>
            <StatusBadge status={active.status} />
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/student/learn"
          className="flex min-h-[44px] items-center justify-center rounded-xl bg-red-700 px-4 py-3 text-sm font-medium text-white active:bg-red-800"
        >
          Continue learning
        </Link>
        <Link
          href="/student/exams"
          className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 active:bg-slate-100"
        >
          View exams
        </Link>
      </div>
    </StudentShell>
  );
}
