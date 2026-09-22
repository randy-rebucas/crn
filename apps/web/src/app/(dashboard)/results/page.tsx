'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, Select, StatusBadge } from '@/components/ui';

interface Exam {
  id: string;
  title: string;
}

interface Attempt {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  student: { id: string };
}

export default function ResultsPage() {
  const [examId, setExamId] = useState('');

  const examsQuery = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });

  const attemptsQuery = useQuery<Attempt[]>({
    queryKey: ['attempts', examId],
    queryFn: async () => (await apiClient.get('/v1/attempts', { params: { examId } })).data,
    enabled: Boolean(examId),
  });

  return (
    <div>
      <PageHeader title="Results" description="Exam attempt outcomes — scores, pass/fail, and grading status." />

      <div className="mb-6 max-w-sm">
        <Field label="Exam">
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select an exam…</option>
            {(examsQuery.data ?? []).map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!examId && <EmptyState title="Select an exam" description="Choose an exam to view its results." />}
      {examId && attemptsQuery.isLoading && <LoadingState />}
      {examId && attemptsQuery.isError && <ErrorState message="Could not load results." />}
      {examId && attemptsQuery.data?.length === 0 && (
        <EmptyState title="No attempts yet" description="No students have attempted this exam." />
      )}

      {examId && attemptsQuery.data && attemptsQuery.data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attemptsQuery.data.map((attempt) => (
                <tr key={attempt.id}>
                  <td className="px-4 py-3 text-slate-600">{attempt.student.id}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={attempt.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {attempt.score ?? '—'} / {attempt.maxScore ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {attempt.passed === null ? (
                      <span className="text-xs text-slate-400">Pending</span>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          attempt.passed
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                            : 'border-red-200 bg-red-100 text-red-700'
                        }`}
                      >
                        {attempt.passed ? 'Passed' : 'Failed'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
