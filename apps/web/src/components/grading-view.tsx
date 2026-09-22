'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  StatusBadge,
} from '@/components/ui';

type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_RESPONSE'
  | 'TRUE_FALSE'
  | 'IDENTIFICATION'
  | 'NUMERICAL'
  | 'ESSAY'
  | 'IMAGE_BASED';

type ExamType = 'PRACTICE' | 'DIAGNOSTIC' | 'MOCK' | 'FINAL';
type ResultRelease = 'IMMEDIATE' | 'DELAYED';
type ContentStatusValue = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

interface Exam {
  id: string;
  organizationId: string;
  programId: string | null;
  title: string;
  type: ExamType;
  timeLimitMinutes: number | null;
  passingScore: number;
  attemptLimit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  resultRelease: ResultRelease;
  status: ContentStatusValue;
  createdAt: string;
}

interface Attempt {
  id: string;
  examId: string;
  studentId: string;
  status: AttemptStatus;
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  student: { id: string };
}

interface AttemptAnswer {
  id: string;
  questionId: string;
  response: unknown;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  needsManualGrading: boolean;
  question: { id: string; content: string; type: QuestionType };
}

interface AttemptDetail extends Attempt {
  answers: AttemptAnswer[];
}

function GradeInput({ onSubmit, disabled }: { onSubmit: (points: number) => void; disabled: boolean }) {
  const [points, setPoints] = useState('0');
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="w-24" />
      <Button type="button" disabled={disabled} onClick={() => onSubmit(Number(points))}>
        Award points
      </Button>
    </div>
  );
}

function GradeAttemptRow({ attempt, onGraded }: { attempt: Attempt; onGraded: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery<AttemptDetail>({
    queryKey: ['attempt-detail', attempt.id],
    queryFn: async () => (await apiClient.get(`/v1/attempts/${attempt.id}`)).data,
    enabled: expanded,
  });

  const grade = useMutation({
    mutationFn: ({ questionId, pointsAwarded }: { questionId: string; pointsAwarded: number }) =>
      apiClient.patch(`/v1/attempts/${attempt.id}/answers/${questionId}/grade`, { pointsAwarded }),
    onSuccess: onGraded,
  });

  return (
    <>
      <tr>
        <td className="px-4 py-3 text-slate-600">{attempt.student.id}</td>
        <td className="px-4 py-3">
          <StatusBadge status={attempt.status} />
        </td>
        <td className="px-4 py-3 text-slate-600">
          {attempt.score ?? '—'} / {attempt.maxScore ?? '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide' : 'Review answers'}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-slate-50 p-4">
            {isLoading && <LoadingState />}
            {data && (
              <ul className="space-y-2">
                {data.answers.map((answer) => (
                  <li key={answer.id} className="rounded bg-white p-3 shadow-sm">
                    <p className="text-sm font-medium text-slate-900">{answer.question.content}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Response: {typeof answer.response === 'string' ? answer.response : JSON.stringify(answer.response)}
                    </p>
                    {answer.needsManualGrading ? (
                      <GradeInput
                        onSubmit={(points) => grade.mutate({ questionId: answer.questionId, pointsAwarded: points })}
                        disabled={grade.isPending}
                      />
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        Auto-graded — {answer.isCorrect ? 'correct' : 'incorrect'} ({answer.pointsAwarded ?? 0} pt)
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// Shared by (dashboard)/exams's Grading tab and (instructor)/instructor/exams —
// the exam engine has no instructor-scoping concept yet (attempts are keyed
// only by examId), so both surfaces show the same exam picker; only the shell
// around it differs.
export function GradingView() {
  const { data: exams } = useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => (await apiClient.get('/v1/exams')).data,
  });
  const [examId, setExamId] = useState('');
  const queryClient = useQueryClient();

  const { data: attempts, isLoading, isError } = useQuery<Attempt[]>({
    queryKey: ['attempts', examId],
    queryFn: async () => (await apiClient.get('/v1/attempts', { params: { examId } })).data,
    enabled: Boolean(examId),
  });

  return (
    <div>
      <div className="mb-4 max-w-sm">
        <Field label="Exam">
          <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select an exam…</option>
            {(exams ?? []).map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!examId && (
        <EmptyState title="Select an exam" description="Choose an exam to view its attempts and grade manually-graded answers." />
      )}
      {examId && isLoading && <LoadingState />}
      {examId && isError && <ErrorState message="Could not load attempts." />}
      {examId && attempts && attempts.length === 0 && (
        <EmptyState title="No attempts yet" description="No students have attempted this exam." />
      )}

      {examId && attempts && attempts.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.map((attempt) => (
                <GradeAttemptRow
                  key={attempt.id}
                  attempt={attempt}
                  onGraded={() => {
                    queryClient.invalidateQueries({ queryKey: ['attempt-detail', attempt.id] });
                    queryClient.invalidateQueries({ queryKey: ['attempts', examId] });
                  }}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
