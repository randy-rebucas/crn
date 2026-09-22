'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useMyEnrollments, useMyAttempts, pickActiveEnrollment } from '@/lib/student-hooks';
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, StudentPageHeader } from '@/components/student-ui';

interface ExamItem {
  id: string;
  title: string;
  type: string;
  status: string;
  programId: string | null;
  attemptLimit: number;
  timeLimitMinutes: number | null;
  passingScore: number;
}

export default function StudentExamsPage() {
  const enrollments = useMyEnrollments();
  const active = pickActiveEnrollment(enrollments.data);

  // The API now scopes GET /v1/exams to PUBLISHED-only for a caller without
  // exams.create/exams.approve, but there's still no program filter
  // server-side, so that part stays client-side.
  const exams = useQuery<ExamItem[]>({
    queryKey: ['exams-for-program', active?.programId],
    enabled: Boolean(active),
    queryFn: async () => {
      const { data } = await apiClient.get<ExamItem[]>('/v1/exams');
      return data.filter((e) => !e.programId || e.programId === active!.programId);
    },
  });

  const myAttempts = useMyAttempts();

  const attemptCountByExam = new Map<string, number>();
  for (const attempt of myAttempts.data ?? []) {
    attemptCountByExam.set(attempt.examId, (attemptCountByExam.get(attempt.examId) ?? 0) + 1);
  }

  return (
    <StudentShell>
      <div className="mb-4 flex items-start justify-between gap-4">
        <StudentPageHeader title="Exams" description="Practice, diagnostic, mock, and final exams for your program." />
        <Link href="/student/progress" className="mt-1 shrink-0 text-xs font-medium text-red-700">
          My performance
        </Link>
      </div>

      {enrollments.isLoading && <LoadingState />}
      {enrollments.isError && <ErrorState message="Could not load your enrollment." />}
      {!enrollments.isLoading && !active && (
        <EmptyState title="No active program" description="Exams appear here once you're enrolled in a program." />
      )}

      {active && exams.isLoading && <LoadingState />}
      {active && exams.isError && <ErrorState message="Could not load exams." />}
      {active && exams.data && exams.data.length === 0 && (
        <EmptyState title="No exams available" description="Nothing has been published for your program yet." />
      )}

      {active && exams.data && exams.data.length > 0 && (
        <div className="space-y-2">
          {exams.data.map((exam) => {
            const takenCount = attemptCountByExam.get(exam.id) ?? 0;
            const atLimit = takenCount >= exam.attemptLimit;
            return (
              <Link key={exam.id} href={`/student/exams/${exam.id}`}>
                <Card className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{exam.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {exam.type} · {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : 'No time limit'} ·{' '}
                      {takenCount}/{exam.attemptLimit} attempts used
                    </div>
                  </div>
                  <StatusBadge status={atLimit ? 'CANCELLED' : 'ACTIVE'} />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
