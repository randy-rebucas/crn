'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from './api-client';
import { useAuth } from './auth-context';

// Data layer for the instructor portal's "Today" view. Everything is
// derived from endpoints an instructor already holds permission for —
// query keys match the ones attendance-view.tsx / grading-view.tsx use, so
// the Today view and the drill-in pages share one cache instead of
// fetching the same rows twice.

export interface InstructorClass {
  id: string;
  name: string;
  status: string;
  course: { name: string; code: string };
  batch: { id: string; name: string };
  room: { name: string } | null;
  instructor: { user: { id: string; firstName: string; lastName: string } } | null;
}

export interface Schedule {
  id: string;
  classId: string;
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startTime: string; // "HH:MM" 24h
  endTime: string;
}

interface ClassDetail extends InstructorClass {
  schedules: Schedule[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  title: string;
  status: string;
}

export interface Attempt {
  id: string;
  examId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  submittedAt: string | null;
  gradedAt: string | null;
  student: { id: string; user: { firstName: string; lastName: string } };
}

export function useMyClasses() {
  const { user, hasPermission } = useAuth();
  const query = useQuery<InstructorClass[]>({
    queryKey: ['classes'],
    enabled: hasPermission('classes.view'),
    queryFn: async () => (await apiClient.get('/v1/classes')).data,
  });
  const classes = useMemo(
    () => (query.data ?? []).filter((cls) => cls.instructor?.user.id === user?.id),
    [query.data, user?.id],
  );
  return { ...query, classes };
}

// The class list payload doesn't carry the instructor's display name
// separately; their own assigned classes do, so reuse that instead of
// falling back to a raw email address.
export function useInstructorName() {
  const { user } = useAuth();
  const { classes } = useMyClasses();
  const owner = classes[0]?.instructor?.user;
  if (owner) return { full: `${owner.firstName} ${owner.lastName}` };
  const local = user?.email.split('@')[0] ?? '';
  const pretty = local.charAt(0).toUpperCase() + local.slice(1);
  return { full: pretty };
}

const ROLE_LABELS: Record<string, string> = {
  lead_instructor: 'Lead Instructor',
  instructor: 'Instructor',
};

export function useRoleLabel() {
  const { user } = useAuth();
  const key = user?.roles.find((r) => r in ROLE_LABELS) ?? user?.roles[0];
  if (!key) return 'Instructor';
  return ROLE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Instructors don't hold `schedules.view`, but GET /v1/classes/:id (gated
// on classes.view) includes each class's weekly schedules.
export function useMySchedules(classIds: string[]) {
  return useQueries({
    queries: classIds.map((id) => ({
      queryKey: ['classes', id, 'detail'],
      queryFn: async () => (await apiClient.get<ClassDetail>(`/v1/classes/${id}`)).data,
    })),
    combine: (results) => ({
      schedules: results.flatMap((r) => r.data?.schedules ?? []),
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  });
}

export interface RosterStudent {
  id: string;
  user: { firstName: string; lastName: string; email: string };
}

export function useMyRosters(classIds: string[]) {
  const { hasPermission } = useAuth();
  const enabled = hasPermission('attendance.view');
  return useQueries({
    queries: classIds.map((id) => ({
      queryKey: ['classes', id, 'roster'],
      enabled,
      queryFn: async () => (await apiClient.get<RosterStudent[]>(`/v1/classes/${id}/roster`)).data,
    })),
    combine: (results) => ({
      byClass: new Map(classIds.map((id, i) => [id, results[i]?.data])),
      // A student can sit in several of the instructor's classes (same
      // batch), so count distinct students rather than summing rosters.
      total: new Set(results.flatMap((r) => (r.data ?? []).map((s) => s.id))).size,
      enabled,
      isLoading: enabled && results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  });
}

export function useMyAttendance(classIds: string[]) {
  const { hasPermission } = useAuth();
  const enabled = hasPermission('attendance.view');
  return useQueries({
    queries: classIds.map((id) => ({
      queryKey: ['attendance', id],
      enabled,
      queryFn: async () =>
        (await apiClient.get<AttendanceRecord[]>('/v1/attendance', { params: { classId: id } })).data,
    })),
    combine: (results) => ({
      records: results.flatMap((r) => r.data ?? []),
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  });
}

// Attempts are listed per exam only (GET /v1/attempts?examId=), and the
// API already scopes them to the caller's classes for ASSIGNED graders.
export function useGradingQueue() {
  const { hasPermission } = useAuth();
  const canGrade = hasPermission('exams.grade');
  const exams = useQuery<Exam[]>({
    queryKey: ['exams'],
    enabled: canGrade && hasPermission('exams.view'),
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  const gradable = (exams.data ?? []).filter((e) => e.status !== 'DRAFT');

  const attempts = useQueries({
    queries: gradable.map((exam) => ({
      queryKey: ['attempts', exam.id],
      queryFn: async () =>
        (await apiClient.get<Attempt[]>('/v1/attempts', { params: { examId: exam.id } })).data,
    })),
    combine: (results) => ({
      attempts: results.flatMap((r) => r.data ?? []),
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  });

  const examTitle = new Map(gradable.map((e) => [e.id, e.title]));
  const pending = attempts.attempts.filter((a) => a.status === 'SUBMITTED');

  return {
    enabled: canGrade,
    attempts: attempts.attempts,
    pendingCount: pending.length,
    examsWithPending: new Set(pending.map((a) => a.examId)).size,
    examTitle,
    isLoading: exams.isLoading || attempts.isLoading,
    isError: exams.isError || attempts.isError,
  };
}
