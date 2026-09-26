'use client';

// Shared react-query hooks for the student-facing (student) route group.
//
// Scoping: most hooks here call self-scoped endpoints (`/me`, `/mine`,
// notifications) and need no client-side narrowing. The exceptions are the
// profile and enrollment lookups, which go through the general list
// endpoints and so match on the caller's own ids below; each says why.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';
import { getStoredRefreshToken, useAuth } from './auth-context';

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
    // Staff with org-wide students.view would get every profile back, so the
    // lookup only runs for student accounts and only ever matches by userId —
    // never "the first one", which for staff is some other student.
    enabled: Boolean(user?.roles.includes('student')),
    queryFn: async () => {
      const { data } = await apiClient.get<StudentProfile[]>('/v1/students');
      return data.find((s) => s.user.id === user?.id) ?? null;
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

// PATCH /v1/students/me resolves the profile from the caller's own userId.
// Only contact fields are editable; `null` clears one.
export interface MyContactDetails {
  phone: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export function useUpdateMyContactDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: MyContactDetails) => (await apiClient.patch<StudentProfile>('/v1/students/me', body)).data,
    onSuccess: (data) => queryClient.setQueryData(['my-student-profile'], data),
  });
}

// GET/PATCH /v1/students/me/preferences — the caller's own notification,
// reminder and consent choices. GET returns defaults until the first save.
export interface StudentPreferences {
  notifySchedule: boolean;
  notifyExams: boolean;
  notifyAnnouncements: boolean;
  notifyPayments: boolean;
  notifyCertificates: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  classReminderMinutes: number | null;
  studyReminderTime: string | null;
  weeklyDigest: boolean;
  allowSuccessStory: boolean;
  marketingOptIn: boolean;
}

export function useMyPreferences() {
  const { user } = useAuth();
  return useQuery<StudentPreferences>({
    queryKey: ['my-preferences'],
    enabled: Boolean(user),
    queryFn: async () => (await apiClient.get<StudentPreferences>('/v1/students/me/preferences')).data,
  });
}

// Optimistic: toggles flip immediately and roll back if the save fails.
export function useUpdateMyPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<StudentPreferences>) =>
      (await apiClient.patch<StudentPreferences>('/v1/students/me/preferences', patch)).data,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['my-preferences'] });
      const previous = queryClient.getQueryData<StudentPreferences>(['my-preferences']);
      if (previous) queryClient.setQueryData(['my-preferences'], { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['my-preferences'], ctx.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(['my-preferences'], data),
  });
}

// POST /v1/auth/change-password signs out every other session; passing our
// own refresh token keeps this one alive.
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiClient.post('/v1/auth/change-password', { ...body, refreshToken: getStoredRefreshToken() ?? undefined }),
  });
}

// Most-live first, then COMPLETED so graduates still land on their program.
// Matches the statuses the API grants program access for
// (PROGRAM_ACCESS_ENROLLMENT_STATUSES); anything else — an application still
// under review, a cancelled or rejected one — is never treated as current.
const ACTIVE_ENROLLMENT_PRIORITY = ['ENROLLED', 'PAYMENT_VERIFIED', 'PAYMENT_PENDING', 'APPROVED', 'COMPLETED'];

export function pickActiveEnrollment(enrollments: Enrollment[] | undefined): Enrollment | null {
  if (!enrollments) return null;
  for (const status of ACTIVE_ENROLLMENT_PRIORITY) {
    const match = enrollments.find((e) => e.status === status);
    if (match) return match;
  }
  return null;
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

// PATCH /v1/notifications/read-all marks every one of the caller's
// notifications read in one request.
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch('/v1/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] }),
  });
}

export type MaterialType = 'TEXT' | 'IMAGE' | 'PDF' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'DOWNLOAD' | 'FLASHCARD';

export interface LibraryMaterial {
  id: string;
  title: string;
  type: MaterialType;
  content: string | null;
  updatedAt: string;
  lesson: {
    id: string;
    name: string;
    module: {
      id: string;
      name: string;
      subject: { id: string; name: string; course: { id: string; name: string; code: string } };
    };
  };
}

// GET /v1/materials/mine is self-scoped server-side: published materials
// (published at every level of the tree) from the caller's enrolled
// programs, already in curriculum order.
export function useMyMaterials(types: MaterialType[]) {
  const { user } = useAuth();
  const type = types.join(',');
  return useQuery<LibraryMaterial[]>({
    queryKey: ['my-materials', type],
    enabled: Boolean(user),
    queryFn: async () => (await apiClient.get<LibraryMaterial[]>('/v1/materials/mine', { params: { type } })).data,
  });
}

export interface MyClassMeeting {
  id: string;
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface MyClass {
  id: string;
  name: string;
  batchId: string;
  status: string;
  course: { id: string; code: string; name: string };
  room: { name: string } | null;
  instructor: { user: { firstName: string; lastName: string } } | null;
  schedules: MyClassMeeting[];
}

// GET /v1/schedules/me is self-scoped server-side: non-cancelled classes in
// every batch the caller is enrolled in, each with its weekly meetings.
// Callers narrow to the active enrollment's batch.
export function useMySchedule() {
  const { user } = useAuth();
  return useQuery<MyClass[]>({
    queryKey: ['my-schedule'],
    enabled: Boolean(user),
    queryFn: async () => (await apiClient.get<MyClass[]>('/v1/schedules/me')).data,
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
