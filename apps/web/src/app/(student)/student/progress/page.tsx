'use client';

import Link from 'next/link';
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, StudentPageHeader, SectionLabel, ProgressBar, StatTile } from '@/components/student-ui';
import { useMyAttempts } from '@/lib/student-hooks';

export default function StudentProgressPage() {
  const attempts = useMyAttempts();

  const items = (attempts.data ?? []).slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const graded = items.filter((a) => a.status === 'GRADED' && a.score !== undefined && a.maxScore !== undefined);

  const averagePct =
    graded.length > 0
      ? Math.round(
          (graded.reduce((sum, a) => sum + a.score! / (a.maxScore! || 1), 0) / graded.length) * 100,
        )
      : null;
  const passCount = graded.filter((a) => a.passed).length;
  const passRatePct = graded.length > 0 ? Math.round((passCount / graded.length) * 100) : null;

  return (
    <StudentShell>
      <StudentPageHeader title="Performance" description="Your exam results and progress over time." />

      {attempts.isLoading && <LoadingState />}
      {attempts.isError && <ErrorState message="Could not load your exam history." />}

      {attempts.data && (
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Exams taken" value={items.length} />
          <StatTile label="Average score" value={averagePct !== null ? `${averagePct}%` : '—'} />
          <StatTile label="Pass rate" value={passRatePct !== null ? `${passRatePct}%` : '—'} />
        </div>
      )}

      <SectionLabel>Exam history</SectionLabel>
      {attempts.data && items.length === 0 && (
        <EmptyState title="No attempts yet" description="Exams you take will show up here with your results." />
      )}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((a) => {
            const pending = a.score === undefined || a.maxScore === undefined;
            const pct = !pending ? Math.round((a.score! / (a.maxScore! || 1)) * 100) : 0;
            return (
              <Link key={a.id} href={`/student/exams/${a.examId}/attempt/${a.id}`}>
                <Card className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{a.exam.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(a.startedAt).toLocaleDateString()}
                        {!pending ? ` · ${a.score}/${a.maxScore}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={pending ? a.status : a.passed ? 'PASSED' : 'FAILED'} />
                  </div>
                  {!pending && (
                    <div className="mt-2">
                      <ProgressBar value={pct} max={100} tone={a.passed ? 'green' : 'red'} />
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </StudentShell>
  );
}
