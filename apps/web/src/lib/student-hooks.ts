'use client';

// Shared react-query hooks for the student-facing (student) route group.
//
// IMPORTANT scoping note (see report to caller for full detail): most API
// list endpoints (`classes`, `schedules`, `courses`, `subjects`, `modules`,
// `lessons`, `materials`, `exams`, `certificates`) are organization-wide and
// are NOT narrowed to "my data" server-side. `students.view` and the
// attempts endpoints (`start`/`submit`/`findResultForStudent`) ARE
// self-scoped server-side. Everywhere else, this file fetches the
// broadest available list and filters client-side by the caller's own
// studentProfile id / active enrollment's programId / batchId. This is a
// stopgap, not a substitute for real server-side scoping — flagged in the
// build report.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';
import { useAuth } from './auth-context';

export interface StudentProfile {
  id: string;
  dateOfBirth: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  educationBackground: string | null;
  branchId: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    status: string;
  };
}

export interface Enrollment {
  id: string;
  status: string;
  createdAt: string;
  studentId: string;
  programId: string;
  batchId: string | null;
  branchId: string;
  student: { id: string; user: { firstName: string; lastName: string; email: string } };
  program: { id: string; name: string; slug: string; status: string };
  batch: { id: string; name: string; startDate: string; endDate: string | null } | null;
}

// GET /v1/students is gated by `students.view`. Its service applies
// `studentScopeWhere(user, 'students.view')`, which resolves to
// `{ userId: user.id }` when the caller's role has that permission at
// SELF scope — i.e. this call returns exactly one profile (the caller's
// own) *if* the student role is provisioned that way. There is no
// dedicated `/v1/students/me` endpoint.
export function useMyStudentProfile() {
  const { user } = useAuth();
  return useQuery<StudentProfile | null>({
    queryKey: ['my-student-profile'],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await apiClient.get<StudentProfile[]>('/v1/students');
      return data.find((s) => s.user.id === user?.id) ?? data[0] ?? null;
    },
  });
}

// GET /v1/enrollments has the same shape of self-scoping question as
// /v1/students, but `enrollments.service.ts` scopes with
// `branchScopeWhere`, which only understands BRANCH scope and returns `{}`
// (no filter) for SELF — so a student-role caller granted `enrollments.view`
// at SELF scope would currently see the WHOLE organization's enrollments,
// not just their own. We defensively filter client-side by studentId too.
export function useMyEnrollments() {
  const profile = useMyStudentProfile();
  return useQuery<Enrollment[]>({
    queryKey: ['my-enrollments', profile.data?.id],
    enabled: Boolean(profile.data),
    queryFn: async () => {
      const { data } = await apiClient.get<Enrollment[]>('/v1/enrollments');
      return data.filter((e) => e.studentId === profile.data!.id);
    },
  });
}

const ACTIVE_ENROLLMENT_PRIORITY = ['ENROLLED', 'PAYMENT_VERIFIED', 'PAYMENT_PENDING', 'APPROVED'];

export function pickActiveEnrollment(enrollments: Enrollment[] | undefined): Enrollment | null {
  if (!enrollments || enrollments.length === 0) return null;
  for (const status of ACTIVE_ENROLLMENT_PRIORITY) {
    const match = enrollments.find((e) => e.status === status);
    if (match) return match;
  }
  return enrollments[0];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

// GET /v1/notifications is self-scoped server-side (filtered by the
// caller's userId in the controller) — no client-side filtering needed,
// unlike the org-wide list endpoints above.
export function useMyNotifications() {
  const { user } = useAuth();
  return useQuery<Notification[]>({
    queryKey: ['my-notifications'],
    enabled: Boolean(user),
    queryFn: async () => (await apiClient.get<Notification[]>('/v1/notifications')).data,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/v1/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] }),
  });
}

export interface AttemptSummary {
  id: string;
  examId: string;
  exam: { id: string; title: string; resultRelease: string; passingScore: number };
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score?: number;
  maxScore?: number;
  passed?: boolean;
}

// GET /v1/attempts/me is self-scoped server-side to the caller's own
// student profile — real attempt history across every exam, with
// delayed-release results redacted to status-only until graded.
export function useMyAttempts() {
  const { user } = useAuth();
  return useQuery<AttemptSummary[]>({
    queryKey: ['my-attempts'],
    enabled: Boolean(user),
    queryFn: async () => (await apiClient.get<AttemptSummary[]>('/v1/attempts/me')).data,
  });
}
