'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, StudentPageHeader } from '@/components/student-ui';

interface ExamDetail {
  id: string;
  title: string;
  type: string;
  passingScore: number;
  attemptLimit: number;
  timeLimitMinutes: number | null;
  resultRelease: string;
  questions: { questionId: string; points: number }[];
}

interface MyAttempt {
  id: string;
  examId: string;
  status: string;
}

export default function ExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const exam = useQuery<ExamDetail>({
    queryKey: ['exam', params.examId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${params.examId}`)).data,
  });

  const myAttempts = useQuery<MyAttempt[]>({
    queryKey: ['attempts', 'me'],
    queryFn: async () => (await apiClient.get('/v1/attempts/me')).data,
  });

  const startAttempt = useMutation({
    mutationFn: async () => (await apiClient.post('/v1/attempts', { examId: params.examId })).data as { id: string },
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({ queryKey: ['exam', params.examId] });
      queryClient.invalidateQueries({ queryKey: ['attempts', 'me'] });
      router.push(`/student/exams/${params.examId}/attempt/${attempt.id}`);
    },
  });

  const pastAttempts = (myAttempts.data ?? []).filter((a) => a.examId === params.examId);
  const takenCount = pastAttempts.length;
  const atLimit = exam.data ? takenCount >= exam.data.attemptLimit : false;

  return (
    <StudentShell>
      {exam.isLoading && <LoadingState />}
      {exam.isError && <ErrorState message="Could not load this exam." />}

      {exam.data && (
        <>
          <StudentPageHeader title={exam.data.title} description={`${exam.data.type} · Passing score ${exam.data.passingScore}`} />

          <Card className="p-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Time limit</dt>
                <dd className="font-medium text-slate-900">{exam.data.timeLimitMinutes ? `${exam.data.timeLimitMinutes} min` : 'None'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Questions</dt>
                <dd className="font-medium text-slate-900">{exam.data.questions.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Attempts used</dt>
                <dd className="font-medium text-slate-900">
                  {takenCount}/{exam.data.attemptLimit}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Results</dt>
                <dd className="font-medium text-slate-900">{exam.data.resultRelease === 'IMMEDIATE' ? 'Immediate' : 'Delayed (after grading)'}</dd>
              </div>
            </dl>

            <Button
              className="mt-4 w-full"
              disabled={atLimit || startAttempt.isPending}
              onClick={() => startAttempt.mutate()}
            >
              {atLimit ? 'Attempt limit reached' : startAttempt.isPending ? 'Starting…' : 'Start attempt'}
            </Button>
            {startAttempt.isError && (
              <p className="mt-2 text-xs text-red-600">Could not start this attempt. It may already be at its limit.</p>
            )}
          </Card>

          <div className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Your attempts</h2>
            {pastAttempts.length === 0 && (
              <EmptyState title="No attempts yet" description="Attempts you start will show here." />
            )}
            {pastAttempts.length > 0 && (
              <div className="space-y-2">
                {pastAttempts.map((attempt) => (
                  <a key={attempt.id} href={`/student/exams/${params.examId}/attempt/${attempt.id}`} className="block">
                    <Card className="flex items-center justify-between p-3 text-sm">
                      <span className="text-slate-600">Attempt {attempt.id.slice(0, 8)}</span>
                      <StatusBadge status={attempt.status} />
                    </Card>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </StudentShell>
  );
}
