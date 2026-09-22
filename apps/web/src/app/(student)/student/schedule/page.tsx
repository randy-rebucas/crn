'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useMyEnrollments, useMyStudentProfile, pickActiveEnrollment } from '@/lib/student-hooks';
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, StudentPageHeader, SectionLabel } from '@/components/student-ui';

interface ClassItem {
  id: string;
  name: string;
  batchId: string;
  status: string;
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
  status: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Read-only: attendance is marked by an instructor (or QR flow), never by
// the student. No self check-in control exists on this page by design.
export default function StudentSchedulePage() {
  const profile = useMyStudentProfile();
  const enrollments = useMyEnrollments();
  const active = pickActiveEnrollment(enrollments.data);

  const classesQuery = useQuery<ClassItem[]>({
    queryKey: ['classes-for-batch', active?.batchId],
    enabled: Boolean(active?.batchId),
    queryFn: async () => {
      const { data } = await apiClient.get<ClassItem[]>('/v1/classes');
      return data.filter((c) => c.batchId === active!.batchId);
    },
  });

  const scheduleQueries = useQueries({
    queries: (classesQuery.data ?? []).map((cls) => ({
      queryKey: ['schedules-for-class', cls.id],
      queryFn: async () => (await apiClient.get<ScheduleItem[]>('/v1/schedules', { params: { classId: cls.id } })).data,
      enabled: Boolean(classesQuery.data),
    })),
  });

  // GET /v1/attendance?studentId= requires `attendance.view`; studentId here
  // is the StudentProfile id (not the User id).
  const attendanceQuery = useQuery<AttendanceItem[]>({
    queryKey: ['my-attendance', profile.data?.id],
    enabled: Boolean(profile.data),
    queryFn: async () =>
      (await apiClient.get<AttendanceItem[]>('/v1/attendance', { params: { studentId: profile.data!.id } })).data,
  });

  const classById = new Map((classesQuery.data ?? []).map((c) => [c.id, c]));

  const byDay: Record<number, { cls: ClassItem; schedule: ScheduleItem }[]> = {};
  (classesQuery.data ?? []).forEach((cls, idx) => {
    for (const s of scheduleQueries[idx]?.data ?? []) {
      byDay[s.dayOfWeek] = byDay[s.dayOfWeek] ?? [];
      byDay[s.dayOfWeek].push({ cls, schedule: s });
    }
  });

  const isLoading = enrollments.isLoading || classesQuery.isLoading;

  return (
    <StudentShell>
      <StudentPageHeader title="Schedule" description="Your weekly class schedule and attendance history." />

      {isLoading && <LoadingState />}
      {enrollments.isError && <ErrorState message="Could not load your enrollment." />}
      {!isLoading && !active && (
        <EmptyState title="No active enrollment" description="Your schedule appears here once you're enrolled and assigned a batch." />
      )}

      {active && !classesQuery.isLoading && (classesQuery.data ?? []).length === 0 && (
        <EmptyState title="No classes yet" description="No classes have been scheduled for your batch yet." />
      )}

      {active && Object.keys(byDay).length > 0 && (
        <div className="space-y-4">
          {DAY_NAMES.map((name, dow) => {
            const entries = (byDay[dow] ?? []).sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime));
            if (entries.length === 0) return null;
            return (
              <div key={dow}>
                <SectionLabel>{name}</SectionLabel>
                <div className="space-y-2">
                  {entries.map(({ cls, schedule }) => (
                    <Card key={schedule.id} className="flex items-center justify-between p-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{cls.name}</div>
                        <div className="text-xs text-slate-500">
                          {schedule.startTime} – {schedule.endTime}
                        </div>
                      </div>
                      <StatusBadge status={cls.status} />
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionLabel>Attendance history</SectionLabel>
      {attendanceQuery.isLoading && <LoadingState />}
      {attendanceQuery.isError && <ErrorState message="Could not load attendance history." />}
      {attendanceQuery.data && attendanceQuery.data.length === 0 && (
        <EmptyState title="No attendance records yet" />
      )}
      {attendanceQuery.data && attendanceQuery.data.length > 0 && (
        <div className="space-y-2">
          {attendanceQuery.data
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((a) => (
              <Card key={a.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm text-slate-900">{classById.get(a.classId)?.name ?? 'Class'}</div>
                  <div className="text-xs text-slate-500">{new Date(a.date).toLocaleDateString()}</div>
                </div>
                <StatusBadge status={a.status} />
              </Card>
            ))}
        </div>
      )}
    </StudentShell>
  );
}
