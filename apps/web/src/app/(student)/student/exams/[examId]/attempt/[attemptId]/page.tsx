'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button, Card, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { StudentShell, StudentPageHeader } from '@/components/student-ui';

interface QuestionOption {
  id: string;
  text: string;
}

interface Question {
  id: string;
  type: string;
  content: string;
  options: QuestionOption[] | null;
}

interface ExamFull {
  id: string;
  title: string;
  resultRelease: string;
  passingScore: number;
  questions: { questionId: string; points: number; question: Question }[];
}

interface AttemptResult {
  id: string;
  status: string;
  score?: number;
  maxScore?: number;
  passed?: boolean;
  submittedAt?: string | null;
}

export default function TakeAttemptPage() {
  const params = useParams<{ examId: string; attemptId: string }>();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const exam = useQuery<ExamFull>({
    queryKey: ['exam-full', params.examId],
    queryFn: async () => (await apiClient.get(`/v1/exams/${params.examId}`)).data,
  });

  const attempt = useQuery<AttemptResult>({
    queryKey: ['attempt', params.attemptId],
    queryFn: async () => (await apiClient.get(`/v1/attempts/${params.attemptId}`)).data,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const payload = {
        answers: Object.entries(answers).map(([questionId, response]) => ({ questionId, response })),
      };
      return (await apiClient.post(`/v1/attempts/${params.attemptId}/submit`, payload)).data as AttemptResult;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attempt', params.attemptId] }),
  });

  const isSubmitted = attempt.data && attempt.data.status !== 'IN_PROGRESS';

  return (
    <StudentShell>
      {(exam.isLoading || attempt.isLoading) && <LoadingState />}
      {(exam.isError || attempt.isError) && <ErrorState message="Could not load this attempt." />}

      {exam.data && attempt.data && (
        <>
          <StudentPageHeader title={exam.data.title} />

          {isSubmitted ? (
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">Result</span>
                <StatusBadge status={attempt.data.status} />
              </div>
              {attempt.data.score !== undefined && attempt.data.maxScore !== undefined ? (
                <>
                  <p className="text-2xl font-semibold text-slate-900">
                    {attempt.data.score} / {attempt.data.maxScore}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {attempt.data.passed ? 'Passed' : 'Did not pass'} · passing score {exam.data.passingScore}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  Your answers were submitted. Results will appear here once grading is complete.
                </p>
              )}
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {exam.data.questions.map(({ question, points }, idx) => (
                  <Card key={question.id} className="p-4">
                    <p className="text-sm font-medium text-slate-900">
                      {idx + 1}. {question.content}{' '}
                      <span className="text-xs font-normal text-slate-400">({points} pt{points === 1 ? '' : 's'})</span>
                    </p>

                    <div className="mt-3">
                      {question.type === 'MULTIPLE_CHOICE' && question.options && (
                        <div className="space-y-2">
                          {question.options.map((opt) => (
                            <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="radio"
                                name={question.id}
                                checked={answers[question.id] === opt.id}
                                onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: opt.id }))}
                              />
                              {opt.text}
                            </label>
                          ))}
                        </div>
                      )}

                      {question.type === 'MULTIPLE_RESPONSE' && question.options && (
                        <div className="space-y-2">
                          {question.options.map((opt) => {
                            const selected = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]) : [];
                            return (
                              <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={selected.includes(opt.id)}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...selected, opt.id]
                                      : selected.filter((id) => id !== opt.id);
                                    setAnswers((prev) => ({ ...prev, [question.id]: next }));
                                  }}
                                />
                                {opt.text}
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {question.type === 'TRUE_FALSE' && (
                        <div className="flex gap-4">
                          {[true, false].map((val) => (
                            <label key={String(val)} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="radio"
                                name={question.id}
                                checked={answers[question.id] === val}
                                onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: val }))}
                              />
                              {val ? 'True' : 'False'}
                            </label>
                          ))}
                        </div>
                      )}

                      {(question.type === 'IDENTIFICATION' || question.type === 'ESSAY') && (
                        <textarea
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
                          rows={question.type === 'ESSAY' ? 4 : 1}
                          value={(answers[question.id] as string) ?? ''}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                        />
                      )}

                      {question.type === 'NUMERICAL' && (
                        <input
                          type="number"
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-600 focus:outline-none"
                          value={(answers[question.id] as string) ?? ''}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: Number(e.target.value) }))}
                        />
                      )}

                      {question.type === 'IMAGE_BASED' && (
                        <p className="text-xs text-slate-400">
                          This question type isn&apos;t fully supported yet in the student app.
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <Button className="mt-4 w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
                {submit.isPending ? 'Submitting…' : 'Submit exam'}
              </Button>
              {submit.isError && <p className="mt-2 text-xs text-red-600">Could not submit. Please try again.</p>}
            </>
          )}
        </>
      )}
    </StudentShell>
  );
}
